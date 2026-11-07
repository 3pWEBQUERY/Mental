/**
 * Vergibt die Admin-Rolle an die Konto-IDs in ADMIN_USER_IDS (kommagetrennt, UUIDs). Läuft als Pre-Deploy-Befehl.
 * Befördert nur, stuft nie herab. Ohne Variable ein No-op.
 *
 * Jede ID nur EINMAL (seed_marks «bootstrap-admin:<id>»): Wurde jemand später über das Vier-Augen-Verfahren
 * herabgestuft (z. B. nach einer Kontoübernahme), macht der nächste Deploy ihn nicht still wieder zum Admin.
 * Für eine erneute Beförderung die Zeile in seed_marks löschen – oder die Rolle im Admin-Bereich vergeben.
 *
 * Bewusst Konto-IDs statt Benutzernamen: Ein Name wird nach Löschung und Ablauf der Reservierung wieder frei –
 * wer ihn dann registriert, würde beim nächsten Deploy Admin. Eine ID wird nie neu vergeben.
 */
import { and, eq, inArray } from 'drizzle-orm'
import { db, pool } from '../db'
import { moderationActions, seedMarks, users } from '../db/schema'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

if (process.env.ADMIN_USERNAMES?.trim()) {
  console.warn('ADMIN_USERNAMES wird nicht mehr ausgewertet – bitte ADMIN_USER_IDS (Konto-IDs) verwenden.')
}

const ids = (process.env.ADMIN_USER_IDS ?? '')
  .split(',')
  .map((n) => n.trim().toLowerCase())
  .filter((n) => UUID.test(n))

if (!ids.length) {
  console.log('ADMIN_USER_IDS leer – keine Rollen vergeben.')
} else {
  const marked = new Set(
    (await db.select({ key: seedMarks.key }).from(seedMarks).where(inArray(seedMarks.key, ids.map((id) => `bootstrap-admin:${id}`)))).map((r) => r.key),
  )
  for (const id of ids) {
    if (marked.has(`bootstrap-admin:${id}`)) {
      console.log(`Admin: ${id} – schon einmal vergeben, unverändert.`)
      continue
    }
    const [u] = await db.select({ role: users.role }).from(users).where(and(eq(users.id, id), eq(users.status, 'active')))
    if (!u) {
      console.log(`Kein aktives Konto mit ID ${id} gefunden.`)
      continue
    }
    if (u.role !== 'admin') {
      await db.update(users).set({ role: 'admin' }).where(eq(users.id, id))
      await db.insert(moderationActions).values({ moderatorId: null, targetType: 'user', targetId: id, action: 'role_bootstrap', reason: 'ADMIN_USER_IDS' })
    }
    await db.insert(seedMarks).values({ key: `bootstrap-admin:${id}` }).onConflictDoNothing()
    console.log(`Admin: ${id}`)
  }
}
await pool.end()

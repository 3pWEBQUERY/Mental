/**
 * Vergibt die Admin-Rolle an die Konto-IDs in ADMIN_USER_IDS (kommagetrennt, UUIDs). Läuft als Pre-Deploy-Befehl.
 * Befördert nur, stuft nie herab. Ohne Variable ein No-op.
 *
 * Bewusst Konto-IDs statt Benutzernamen: Ein Name wird nach Löschung und Ablauf der Reservierung wieder frei –
 * wer ihn dann registriert, würde beim nächsten Deploy Admin. Eine ID wird nie neu vergeben.
 */
import { inArray } from 'drizzle-orm'
import { db, pool } from '../db'
import { users } from '../db/schema'

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
  const done = await db.update(users).set({ role: 'admin' }).where(inArray(users.id, ids)).returning({ id: users.id })
  const found = new Set(done.map((u) => u.id))
  for (const id of ids) console.log(found.has(id) ? `Admin: ${id}` : `Kein Konto mit ID ${id} gefunden.`)
}
await pool.end()

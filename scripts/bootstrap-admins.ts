/**
 * Vergibt die Admin-Rolle an die Benutzernamen in ADMIN_USERNAMES (kommagetrennt).
 * Läuft als Pre-Deploy-Befehl. Befördert nur, stuft nie herab – Rollen entzieht man mit
 * `npm run admin:grant -- <name> member`. Ohne Variable ein No-op.
 */
import { inArray } from 'drizzle-orm'
import { db, pool } from '../db'
import { users } from '../db/schema'

const names = (process.env.ADMIN_USERNAMES ?? '')
  .split(',')
  .map((n) => n.trim().toLowerCase())
  .filter(Boolean)

if (!names.length) {
  console.log('ADMIN_USERNAMES leer – keine Rollen vergeben.')
} else {
  const done = await db.update(users).set({ role: 'admin' }).where(inArray(users.username, names)).returning({ username: users.username })
  const found = new Set(done.map((u) => u.username))
  for (const n of names) console.log(found.has(n) ? `Admin: ${n}` : `Kein Konto «${n}» gefunden.`)
}
await pool.end()

/**
 * Rolle vergeben – nur von der Kommandozeile aus (Railway-Shell), nie über die App.
 *   npm run admin:grant -- <benutzername> <member|peer_mod|mod|admin>
 */
import { eq } from 'drizzle-orm'
import { db, pool } from '../db'
import { users } from '../db/schema'

const [username, role = 'admin'] = process.argv.slice(2)
const roles = ['member', 'peer_mod', 'mod', 'admin'] as const
if (!username || !roles.includes(role as (typeof roles)[number])) {
  console.error('Aufruf: npm run admin:grant -- <benutzername> <member|peer_mod|mod|admin>')
  process.exit(1)
}
const res = await db
  .update(users)
  .set({ role: role as (typeof roles)[number] })
  .where(eq(users.username, username.toLowerCase()))
  .returning({ id: users.id })
console.log(res.length ? `${username} ist jetzt ${role}.` : `Kein Konto «${username}» gefunden.`)
await pool.end()

/**
 * Bestehende Klartext-Werte nachträglich verschlüsseln (nach dem Setzen von DATA_ENCRYPTION_KEY,
 * beliebig oft wiederholbar – schon verschlüsselte Werte bleiben unverändert). Läuft im Pre-Deploy des
 * web-Service mit; ohne Schlüssel tut es nichts.
 *   DATA_ENCRYPTION_KEY=… npm run data:encrypt
 */
import { and, eq, isNotNull, not, sql } from 'drizzle-orm'
import { db, pool } from '../db'
import { checkins, letters, safetyPlans } from '../db/schema'
import { atRestEnabled, sealJson, sealText } from '../lib/at-rest'

/** Einmal mit Schlüssel durchgelaufen: Neue Werte werden danach beim Schreiben verschlüsselt, ein erneuter Durchlauf
 * bei jedem Deploy wäre nur ein wachsender Tabellen-Scan. Für einen neuen Durchlauf die Zeile in seed_marks löschen. */
const MARK = 'encrypt-at-rest-v1'

async function main() {
  if (!atRestEnabled()) return console.log('[encrypt] kein DATA_ENCRYPTION_KEY – nichts zu tun')
  const done = await db.execute(sql`SELECT 1 FROM seed_marks WHERE key = ${MARK}`)
  if (done.rows.length) return console.log('[encrypt] schon erledigt – übersprungen')
  let n = 0
  for (const c of await db
    .select({ id: checkins.id, userId: checkins.userId, note: checkins.note })
    .from(checkins)
    .where(and(isNotNull(checkins.note), not(sql`${checkins.note} LIKE 'enc:v1:%'`)))) {
    await db.update(checkins).set({ note: sealText(c.userId, c.note) }).where(eq(checkins.id, c.id))
    n++
  }
  for (const l of await db.select({ id: letters.id, userId: letters.userId, body: letters.body }).from(letters).where(not(sql`${letters.body} LIKE 'enc:v1:%'`))) {
    await db.update(letters).set({ body: sealText(l.userId, l.body) }).where(eq(letters.id, l.id))
    n++
  }
  for (const p of await db.select({ userId: safetyPlans.userId, plan: safetyPlans.plan }).from(safetyPlans).where(not(sql`${safetyPlans.plan} ? '_enc'`))) {
    await db.update(safetyPlans).set({ plan: sealJson(p.userId, p.plan) }).where(eq(safetyPlans.userId, p.userId))
    n++
  }
  await db.execute(sql`INSERT INTO seed_marks (key) VALUES (${MARK}) ON CONFLICT DO NOTHING`)
  console.log(`[encrypt] ${n} Werte verschlüsselt`)
}

main()
  .catch((e) => {
    console.error('[encrypt] fehlgeschlagen:', (e as Error).message)
    process.exitCode = 1
  })
  .finally(() => pool.end())

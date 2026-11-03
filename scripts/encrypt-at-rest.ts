/**
 * Bestehende Klartext-Werte nachträglich verschlüsseln (nach dem Setzen von DATA_ENCRYPTION_KEY,
 * beliebig oft wiederholbar; auch nach einem Schlüsselwechsel). Läuft im Pre-Deploy des
 * web-Service mit; ohne Schlüssel tut es nichts.
 *   DATA_ENCRYPTION_KEY=… npm run data:encrypt
 */
import { and, eq, isNotNull, not, sql } from 'drizzle-orm'
import { db, pool } from '../db'
import { checkins, letters, safetyPlans } from '../db/schema'
import { currentKeyId, currentPrefix, openJson, openText, sealJson, sealText } from '../lib/at-rest'

/**
 * Einmal je Schlüssel: Neue Werte werden danach beim Schreiben verschlüsselt, ein erneuter Durchlauf bei jedem
 * Deploy wäre nur ein wachsender Tabellen-Scan. Ein neuer Schlüssel (Wechsel) hat eine neue Marke – dann läuft
 * das Skript wieder und verschlüsselt alles, was noch mit dem alten (DATA_ENCRYPTION_KEYS_OLD) oder im Klartext
 * gespeichert ist, mit dem neuen. Für einen neuen Durchlauf die Zeile in seed_marks löschen.
 */
const SKIP = Symbol('skip')
let skipped = 0
/** Unlesbare Werte (Schlüssel fehlt) nie anfassen – sonst würde die Chiffre als Klartext neu verschlüsselt. */
function tryOpen<T>(fn: () => T): T | typeof SKIP {
  try {
    return fn()
  } catch {
    skipped++
    return SKIP
  }
}

async function main() {
  const id = currentKeyId()
  const prefix = currentPrefix()
  if (!id || !prefix) return console.log('[encrypt] kein DATA_ENCRYPTION_KEY – nichts zu tun')
  const MARK = `encrypt-at-rest-v2-${id}`
  const done = await db.execute(sql`SELECT 1 FROM seed_marks WHERE key = ${MARK}`)
  if (done.rows.length) return console.log('[encrypt] schon erledigt – übersprungen')
  const like = `${prefix}%`
  let n = 0
  for (const c of await db
    .select({ id: checkins.id, userId: checkins.userId, note: checkins.note })
    .from(checkins)
    .where(and(isNotNull(checkins.note), not(sql`${checkins.note} LIKE ${like}`)))) {
    const note = tryOpen(() => openText(c.userId, c.note))
    if (note === SKIP) continue
    await db.update(checkins).set({ note: sealText(c.userId, note) }).where(eq(checkins.id, c.id))
    n++
  }
  for (const l of await db.select({ id: letters.id, userId: letters.userId, body: letters.body }).from(letters).where(not(sql`${letters.body} LIKE ${like}`))) {
    const body = tryOpen(() => openText(l.userId, l.body))
    if (body === SKIP) continue
    await db.update(letters).set({ body: sealText(l.userId, body) }).where(eq(letters.id, l.id))
    n++
  }
  for (const p of await db
    .select({ userId: safetyPlans.userId, plan: safetyPlans.plan })
    .from(safetyPlans)
    .where(sql`NOT (${safetyPlans.plan} ? '_enc') OR NOT (${safetyPlans.plan} ->> '_enc' LIKE ${like})`)) {
    const plan = tryOpen(() => openJson(p.userId, p.plan) ?? p.plan)
    if (plan === SKIP) continue
    await db.update(safetyPlans).set({ plan: sealJson(p.userId, plan) }).where(eq(safetyPlans.userId, p.userId))
    n++
  }
  if (skipped) {
    // Nicht als erledigt markieren: Nach dem Nachtragen des fehlenden Schlüssels läuft es beim nächsten Deploy wieder.
    console.error(`[encrypt] ${n} Werte verschlüsselt, ${skipped} übersprungen – sie passen zu keinem gesetzten Schlüssel (DATA_ENCRYPTION_KEYS_OLD prüfen)`)
    return
  }
  await db.execute(sql`INSERT INTO seed_marks (key) VALUES (${MARK}) ON CONFLICT DO NOTHING`)
  console.log(`[encrypt] ${n} Werte mit Schlüssel ${id} verschlüsselt`)
}

main()
  .catch((e) => {
    console.error('[encrypt] fehlgeschlagen:', (e as Error).message)
    process.exitCode = 1
  })
  .finally(() => pool.end())

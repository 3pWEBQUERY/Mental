import { and, eq, isNotNull, not, sql } from 'drizzle-orm'
import { db } from '../db'
import { checkins, letters, safetyPlans } from '../db/schema'
import { currentKeyId, currentPrefix, openJson, openText, sealJson, sealText } from './at-rest'

/**
 * Einmal je Schlüssel: Neue Werte werden danach beim Schreiben verschlüsselt, ein erneuter Durchlauf bei jedem
 * Deploy wäre nur ein wachsender Tabellen-Scan. Ein neuer Schlüssel (Wechsel) hat eine neue Marke – dann läuft
 * das Skript wieder und verschlüsselt alles, was noch mit dem alten (DATA_ENCRYPTION_KEYS_OLD) oder im Klartext
 * gespeichert ist, mit dem neuen. Für einen neuen Durchlauf die Zeile in seed_marks löschen.
 */
const SKIP = Symbol('skip')
/** Unlesbare Werte (Schlüssel fehlt) nie anfassen – sonst würde die Chiffre als Klartext neu verschlüsselt. */
function tryOpen<T>(fn: () => T, count: () => void): T | typeof SKIP {
  try {
    return fn()
  } catch {
    count()
    return SKIP
  }
}

/**
 * Ein Durchlauf. Jede Zeile wird nur ersetzt, wenn sie sich seit dem Lesen nicht geändert hat (sonst ginge eine
 * gleichzeitige Änderung verloren). Als erledigt gilt der Schlüssel erst, wenn ein Durchlauf nichts mehr findet:
 * Während eines Deploys schreiben alte Replikas noch mit dem alten Schlüssel – der Worker läuft darum nach seinem
 * Start noch einmal (worker/index.ts) und zieht diese Werte nach.
 */
export async function reencryptAtRest(log: (msg: string) => void = console.log) {
  let skipped = 0
  const miss = () => {
    skipped++
  }
  const id = currentKeyId()
  const prefix = currentPrefix()
  if (!id || !prefix) return log('[encrypt] kein DATA_ENCRYPTION_KEY – nichts zu tun')
  const MARK = `encrypt-at-rest-v2-${id}`
  const done = await db.execute(sql`SELECT 1 FROM seed_marks WHERE key = ${MARK}`)
  if (done.rows.length) return log('[encrypt] schon erledigt – übersprungen')
  const like = `${prefix}%`
  let n = 0
  for (const c of await db
    .select({ id: checkins.id, userId: checkins.userId, note: checkins.note })
    .from(checkins)
    .where(and(isNotNull(checkins.note), not(sql`${checkins.note} LIKE ${like}`)))) {
    const note = tryOpen(() => openText(c.userId, c.note), miss)
    if (note === SKIP) continue
    const r = await db.update(checkins).set({ note: sealText(c.userId, note) }).where(and(eq(checkins.id, c.id), eq(checkins.note, c.note!))).returning({ id: checkins.id })
    n += r.length
  }
  for (const l of await db.select({ id: letters.id, userId: letters.userId, body: letters.body }).from(letters).where(not(sql`${letters.body} LIKE ${like}`))) {
    const body = tryOpen(() => openText(l.userId, l.body), miss)
    if (body === SKIP) continue
    const r = await db.update(letters).set({ body: sealText(l.userId, body) }).where(and(eq(letters.id, l.id), eq(letters.body, l.body))).returning({ id: letters.id })
    n += r.length
  }
  for (const p of await db
    .select({ userId: safetyPlans.userId, plan: safetyPlans.plan })
    .from(safetyPlans)
    .where(sql`NOT (${safetyPlans.plan} ? '_enc') OR NOT (${safetyPlans.plan} ->> '_enc' LIKE ${like})`)) {
    const plan = tryOpen(() => openJson(p.userId, p.plan) ?? p.plan, miss)
    if (plan === SKIP) continue
    const r = await db
      .update(safetyPlans)
      .set({ plan: sealJson(p.userId, plan) })
      .where(and(eq(safetyPlans.userId, p.userId), sql`${safetyPlans.plan} = ${JSON.stringify(p.plan)}::jsonb`))
      .returning({ userId: safetyPlans.userId })
    n += r.length
  }
  if (skipped) {
    // Nicht als erledigt markieren: Nach dem Nachtragen des fehlenden Schlüssels läuft es beim nächsten Deploy wieder.
    console.error(`[encrypt] ${n} Werte verschlüsselt, ${skipped} übersprungen – sie passen zu keinem gesetzten Schlüssel (DATA_ENCRYPTION_KEYS_OLD prüfen)`)
    return
  }
  if (n > 0) return log(`[encrypt] ${n} Werte mit Schlüssel ${id} verschlüsselt – ein weiterer Durchlauf (Worker-Start) prüft nach`)
  await db.execute(sql`INSERT INTO seed_marks (key) VALUES (${MARK}) ON CONFLICT DO NOTHING`)
  log(`[encrypt] alles mit Schlüssel ${id} verschlüsselt – erledigt`)
}


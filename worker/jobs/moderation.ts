import { and, eq, gt, isNull, lt, sql } from 'drizzle-orm'
import { db } from '../../db'
import { crisisTerms, posts, replies, reports } from '../../db/schema'
import { ALL_DEFAULT_CRISIS_TERMS, maxLevel } from '../../lib/crisis'
import { classify } from '../../lib/moderation'
import { syncReplyCount } from '../../lib/reply-count'
import { alertAcute } from '../../lib/acute-alert'
import { safeMessage } from '../../lib/log-safe'
import { enqueue, QUEUES } from '../../lib/jobs'

async function terms() {
  const rows = await db.select({ term: crisisTerms.term, level: crisisTerms.level }).from(crisisTerms).where(eq(crisisTerms.active, true))
  return rows.length ? rows : ALL_DEFAULT_CRISIS_TERMS
}

async function openReportExists(targetType: 'post' | 'reply', targetId: string, reason: 'auto_acute' | 'auto_flag', tx: Pick<typeof db, 'select'> = db) {
  const [r] = await tx
    .select({ id: reports.id })
    .from(reports)
    .where(and(eq(reports.targetType, targetType), eq(reports.targetId, targetId), eq(reports.reason, reason), eq(reports.status, 'open')))
    .limit(1)
  return Boolean(r)
}

/**
 * Stufe 2 der Krisenerkennung und automatische Prüfung nach dem Teilen.
 * - concern: oben in «Braucht Zuspruch», die Autorin sieht eine dauerhafte Hilfe-Karte.
 * - acute: höchste Priorität in der Warteschlange, bis zur Prüfung nur für die Autorin sichtbar.
 * - Treffer (Hass, Belästigung, Spam, sexuell, persönliche Daten): automatische Meldung mit niedrigster Priorität.
 */
export async function moderateContent({ targetType, targetId }: { targetType: 'post' | 'reply'; targetId: string }) {
  const table = targetType === 'post' ? posts : replies
  const [row] = await db
    .select({ body: table.body, status: table.status, crisisLevel: table.crisisLevel, deletedAt: table.deletedAt })
    .from(table)
    .where(eq(table.id, targetId))
  if (!row || row.deletedAt || !row.body) return

  const result = await classify(row.body, await terms())
  const level = maxLevel(row.crisisLevel, result.crisis)
  if (level !== row.crisisLevel) {
    await db
      .update(table)
      .set({ crisisLevel: level, ...(level === 'acute' && row.status === 'visible' ? { status: 'pending' as const } : {}) })
      .where(eq(table.id, targetId))
    if (targetType === 'reply' && level === 'acute' && row.status === 'visible') {
      const [r] = await db.select({ postId: replies.postId }).from(replies).where(eq(replies.id, targetId))
      if (r) await syncReplyCount(r.postId)
    }
  }
  // Prüfen und Einfügen unter einer Sperre je Inhalt: Laufen zwei Prüfungen gleichzeitig (Nachzügler), entsteht nur
  // ein Fall – und nur ein Alarm.
  const added = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`report:${targetId}`}))`)
    let acute = false
    if (level === 'acute' && !(await openReportExists(targetType, targetId, 'auto_acute', tx))) {
      await tx.insert(reports).values({ targetType, targetId, reason: 'auto_acute', priority: 0 })
      acute = true
    }
    if (result.flags.length && !(await openReportExists(targetType, targetId, 'auto_flag', tx))) {
      await tx.insert(reports).values({ targetType, targetId, reason: 'auto_flag', note: result.flags.join(', '), priority: 3 })
    }
    return acute
  })
  if (added) await alertAcute().catch((e) => console.error('[acute] Alarm fehlgeschlagen:', safeMessage(e)))
  await db.update(table).set({ moderatedAt: new Date() }).where(eq(table.id, targetId))
}

/**
 * Sicherheitsnetz: Ging das Einreihen der Prüfung beim Teilen schief (oder hat sie alle Versuche aufgebraucht),
 * bliebe ein Gedanke für immer ungeprüft. Alle 10 Minuten werden solche Inhalte der letzten 3 Tage erneut eingereiht.
 * Die Prüfung ist wiederholbar (Meldungen nur, wenn noch keine offen ist).
 */
export async function requeueUnmoderated() {
  const now = Date.now()
  const window = (t: typeof posts | typeof replies) =>
    and(isNull(t.moderatedAt), isNull(t.deletedAt), lt(t.createdAt, new Date(now - 10 * 60_000)), gt(t.createdAt, new Date(now - 3 * 86_400_000)))
  const [p, r] = await Promise.all([
    db.select({ id: posts.id }).from(posts).where(window(posts)).limit(100),
    db.select({ id: replies.id }).from(replies).where(window(replies)).limit(100),
  ])
  // Höchstens ein Nachzügler pro Inhalt und Stunde (pg-boss: singletonKey + singletonSeconds).
  for (const x of p) await enqueue(QUEUES.moderate, { targetType: 'post', targetId: x.id }, { singletonKey: `mod:${x.id}`, singletonSeconds: 3600 })
  for (const x of r) await enqueue(QUEUES.moderate, { targetType: 'reply', targetId: x.id }, { singletonKey: `mod:${x.id}`, singletonSeconds: 3600 })
  if (p.length || r.length) console.log(`[moderation] ${p.length + r.length} ungeprüfte Inhalte erneut eingereiht`)
}

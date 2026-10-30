import { and, eq } from 'drizzle-orm'
import { db } from '../../db'
import { crisisTerms, posts, replies, reports } from '../../db/schema'
import { DEFAULT_CRISIS_TERMS, maxLevel } from '../../lib/crisis'
import { classify } from '../../lib/moderation'

async function terms() {
  const rows = await db.select({ term: crisisTerms.term, level: crisisTerms.level }).from(crisisTerms)
  return rows.length ? rows : DEFAULT_CRISIS_TERMS
}

async function openReportExists(targetType: 'post' | 'reply', targetId: string, reason: 'auto_acute' | 'auto_flag') {
  const [r] = await db
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
  }
  if (level === 'acute' && !(await openReportExists(targetType, targetId, 'auto_acute'))) {
    await db.insert(reports).values({ targetType, targetId, reason: 'auto_acute', priority: 0 })
  }
  if (result.flags.length && !(await openReportExists(targetType, targetId, 'auto_flag'))) {
    await db.insert(reports).values({ targetType, targetId, reason: 'auto_flag', note: result.flags.join(', '), priority: 3 })
  }
}

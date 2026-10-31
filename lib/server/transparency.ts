import 'server-only'
import { cacheLife, cacheTag } from 'next/cache'
import { sql } from 'drizzle-orm'
import { db } from '@/db'
import { safeMessage } from '../log-safe'

/** Kleinere Werte als dieser werden nur als «weniger als 10» gezeigt – einzelne Fälle sollen nicht erkennbar sein. */
export const MIN_COUNT = 10

/** Eine Zahl oder «unterdrückt» (1 bis MIN_COUNT − 1). Null bleibt null – das verrät niemanden. */
export type Figure = { n: number } | { below: number }

export type Quarter = {
  /** z. B. «3. Quartal 2026» */
  label: string
  posts: Figure
  replies: Figure
  /** Anteil der Gedanken mit einer Antwort innerhalb von 24 Stunden – nur ab MIN_COUNT Gedanken. */
  answeredShare: number | null
  reports: Figure
  byReason: { reason: string; n: Figure }[]
  /** Median der Zeit bis zur Bearbeitung akuter Krisenhinweise, in Minuten – nur ab MIN_COUNT Fällen. */
  crisisMedian: number | null
  hidden: Figure
  warnings: Figure
  mutes: Figure
  bans: Figure
  appeals: Figure
  appealsAccepted: Figure
}

export function figure(n: number): Figure {
  return n > 0 && n < MIN_COUNT ? { below: MIN_COUNT } : { n }
}

const FALLBACK = { stale: 30, revalidate: 30, expire: 300 }

type Row = Record<string, unknown>
const rows = <T extends Row>(q: ReturnType<typeof sql>) => db.execute<T>(q).then((r) => r.rows)

/**
 * Die letzten zwei abgeschlossenen Quartale. Nur Zählungen über ganze Quartale, nie Inhalte oder Konten.
 * Für jede Replika einmal pro Stunde neu berechnet; beim Build (ohne DB) kurz die leere Rückfallseite.
 */
export async function getTransparency(): Promise<Quarter[] | null> {
  'use cache'
  cacheTag('transparency')
  try {
    const quarters = await rows<{ q: string; label_q: number; label_y: number }>(sql`
      SELECT q::text AS q, extract(quarter FROM q)::int AS label_q, extract(year FROM q)::int AS label_y
      FROM generate_series(date_trunc('quarter', now()) - interval '6 months', date_trunc('quarter', now()) - interval '3 months', interval '3 months') AS q
      ORDER BY q DESC`)
    const out = await Promise.all(quarters.map((q) => quarter(q.q, `${q.label_q}. Quartal ${q.label_y}`)))
    cacheLife('hours')
    return out
  } catch (e) {
    console.error('[transparency]', safeMessage(e))
    cacheLife(FALLBACK)
    return null
  }
}

async function quarter(from: string, label: string): Promise<Quarter> {
  const range = sql`>= ${from}::timestamptz AND created_at < ${from}::timestamptz + interval '3 months'`
  const pRange = sql`>= ${from}::timestamptz AND p.created_at < ${from}::timestamptz + interval '3 months'`
  const [content, reports, reasons, crisis, actions, userActs] = await Promise.all([
    rows<{ posts: number; replies: number; answered: number; visible: number }>(sql`
      SELECT
        (SELECT count(*)::int FROM posts WHERE created_at ${range}) AS posts,
        (SELECT count(*)::int FROM replies WHERE created_at ${range}) AS replies,
        (SELECT count(*)::int FROM posts p WHERE p.created_at ${pRange}
           AND p.status = 'visible'
           AND EXISTS (SELECT 1 FROM replies r WHERE r.post_id = p.id AND r.status = 'visible' AND r.created_at < p.created_at + interval '24 hours')) AS answered,
        (SELECT count(*)::int FROM posts p WHERE p.created_at ${pRange}
           AND p.status = 'visible') AS visible`),
    rows<{ total: number; appeals: number }>(sql`
      SELECT count(*) FILTER (WHERE target_type <> 'user')::int AS total, count(*) FILTER (WHERE target_type = 'user')::int AS appeals
      FROM reports WHERE created_at ${range}`),
    rows<{ reason: string; n: number }>(sql`
      SELECT CASE WHEN reason IN ('auto_acute', 'auto_flag') THEN 'auto' ELSE reason::text END AS reason, count(*)::int AS n
      FROM reports WHERE target_type <> 'user' AND created_at ${range} GROUP BY 1 ORDER BY n DESC`),
    rows<{ n: number; median: number | null }>(sql`
      SELECT count(*)::int AS n, percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM resolved_at - created_at) / 60) AS median
      FROM reports WHERE priority = 0 AND resolved_at IS NOT NULL AND target_type <> 'user' AND created_at ${range}`),
    rows<{ action: string; n: number }>(sql`
      SELECT action, count(*)::int AS n FROM moderation_actions
      WHERE created_at ${range} AND (target_type <> 'user' OR action = 'appeal_accept') GROUP BY action`),
    // Stummschaltungen und Sperren stehen doppelt im Protokoll (am Inhalt und am Konto) – gezählt wird nur die Konto-Zeile.
    rows<{ action: string; n: number }>(sql`
      SELECT action, count(*)::int AS n FROM moderation_actions
      WHERE created_at ${range} AND target_type = 'user' AND action IN ('ban', 'mute24', 'mute7') GROUP BY action`),
  ])
  const c = content[0] ?? { posts: 0, replies: 0, answered: 0, visible: 0 }
  const r = reports[0] ?? { total: 0, appeals: 0 }
  const k = crisis[0] ?? { n: 0, median: null }
  const act = (name: string) => actions.find((a) => a.action === name)?.n ?? 0
  const userAct = (name: string) => userActs.find((a) => a.action === name)?.n ?? 0
  return {
    label,
    posts: figure(c.posts),
    replies: figure(c.replies),
    answeredShare: c.visible >= MIN_COUNT ? Math.round((c.answered / c.visible) * 100) : null,
    reports: figure(r.total),
    byReason: reasons.map((x) => ({ reason: x.reason, n: figure(x.n) })),
    crisisMedian: k.n >= MIN_COUNT && k.median !== null ? Math.round(Number(k.median)) : null,
    hidden: figure(act('hide')),
    warnings: figure(act('cw')),
    mutes: figure(userAct('mute24') + userAct('mute7')),
    bans: figure(userAct('ban')),
    appeals: figure(r.appeals),
    appealsAccepted: figure(act('appeal_accept')),
  }
}

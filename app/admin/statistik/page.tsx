import { sql } from 'drizzle-orm'
import { db } from '@/db'
import { requireModerator } from '@/lib/server/admin'
import { m } from '@/messages'

/** Kennzahlen aus der Warteschlange – nur Zahlen, nie Inhalte. Grundlage für Besetzung und Transparenzbericht. */
export default async function StatsPage() {
  await requireModerator('mod')
  const t = m.admin.stats
  const q = <T,>(query: ReturnType<typeof sql>) => db.execute<T & Record<string, unknown>>(query).then((r) => r.rows)
  const [byPriority, byReason, overdue, unheard, appeals] = await Promise.all([
    q<{ priority: number; open: number; created: number; median: number | null }>(sql`
      SELECT priority,
        count(*) FILTER (WHERE status = 'open')::int AS open,
        count(*) FILTER (WHERE created_at > now() - interval '30 days')::int AS created,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM resolved_at - created_at) / 60)
          FILTER (WHERE resolved_at IS NOT NULL AND created_at > now() - interval '30 days') AS median
      FROM reports WHERE target_type <> 'user' GROUP BY priority ORDER BY priority`),
    q<{ reason: string; n: number }>(sql`
      SELECT reason, count(*)::int AS n FROM reports
      WHERE created_at > now() - interval '30 days' AND target_type <> 'user' GROUP BY reason ORDER BY n DESC`),
    q<{ n: number }>(sql`SELECT count(*)::int AS n FROM reports WHERE status = 'open' AND priority = 0 AND created_at < now() - interval '30 minutes'`),
    q<{ n: number; total: number }>(sql`
      SELECT count(*) FILTER (WHERE reply_count = 0)::int AS n, count(*)::int AS total FROM posts
      WHERE created_at BETWEEN now() - interval '30 days' AND now() - interval '24 hours' AND deleted_at IS NULL AND status = 'visible'`),
    q<{ open: number; created: number }>(sql`
      SELECT count(*) FILTER (WHERE status = 'open')::int AS open, count(*) FILTER (WHERE created_at > now() - interval '30 days')::int AS created
      FROM reports WHERE target_type = 'user'`),
  ])
  const reasonLabel: Record<string, string> = { ...m.report.reasons, auto_acute: m.admin.autoAcute, auto_flag: m.admin.autoFlag }
  const un = unheard[0] ?? { n: 0, total: 0 }
  return (
    <div className="stack">
      <h1 className="page-title">{t.title}</h1>
      <p className="fine" style={{ maxWidth: 640 }}>
        {t.intro}
      </p>
      <table className="table">
        <thead>
          <tr>
            <th>Priorität</th>
            <th>{t.open}</th>
            <th>{t.created}</th>
            <th>{t.median}</th>
          </tr>
        </thead>
        <tbody>
          {byPriority.map((r) => (
            <tr key={r.priority}>
              <td>{m.admin.priority[r.priority] ?? r.priority}</td>
              <td>{r.open}</td>
              <td>{r.created}</td>
              <td>{t.minutes(r.median === null ? null : Number(r.median))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="facts">
        <div>
          <dt>{t.overdue}</dt>
          <dd>{overdue[0]?.n ?? 0}</dd>
        </div>
        <div>
          <dt>{t.unheard}</dt>
          <dd>
            {un.n} / {un.total}
          </dd>
        </div>
        <div>
          <dt>{t.appeals}</dt>
          <dd>
            {appeals[0]?.open ?? 0} offen · {appeals[0]?.created ?? 0} neu
          </dd>
        </div>
      </dl>
      <h2 className="section-title">{t.byReason}</h2>
      <table className="table">
        <tbody>
          {byReason.map((r) => (
            <tr key={r.reason}>
              <td>{reasonLabel[r.reason] ?? r.reason}</td>
              <td>{r.n}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

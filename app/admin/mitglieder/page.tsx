import { and, desc, eq, isNull, ne, or, sql, type SQL } from 'drizzle-orm'
import Link from 'next/link'
import { db } from '@/db'
import { users } from '@/db/schema'
import { memberToken, requireModerator } from '@/lib/server/admin'
import { memberRef } from '@/lib/server/crypto'
import { formatDate } from '@/lib/time'
import { m } from '@/messages'

const PAGE = 50
const FILTERS = ['all', 'active', 'muted', 'banned', 'deleting', 'staff', 'reported'] as const
type Filter = (typeof FILTERS)[number]

/** Offene Meldungen zu Inhalten eines Kontos (Gedanken und Antworten). */
const openReports = sql<number>`(
  SELECT count(*)::int FROM reports r
  WHERE r.status = 'open' AND (
    (r.target_type = 'post' AND r.target_id IN (SELECT p.id FROM posts p WHERE p.user_id = ${users.id}))
    OR (r.target_type = 'reply' AND r.target_id IN (SELECT rp.id FROM replies rp WHERE rp.user_id = ${users.id}))
  )
)`

/**
 * Mitglieder verwalten: alle Konten mit Mitglieds-ID, Status, Rolle und Aktivität – nie mit Benutzernamen.
 * Die Mitglieds-ID ist ein HMAC und lässt sich nicht zurückrechnen; gesucht wird darum, indem sie für die Konten
 * berechnet und verglichen wird. Massnahmen auf der Kontoseite (/admin/konto/…).
 */
export default async function MembersPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; seite?: string }> }) {
  await requireModerator('mod')
  const raw = await searchParams
  // Doppelte Parameter (?q=a&q=b) kommen als Liste – nur den ersten nehmen statt abzustürzen.
  const one = (v: unknown) => (Array.isArray(v) ? v[0] : v) as string | undefined
  const sp = { status: one(raw.status), q: one(raw.q), seite: one(raw.seite) }
  const t = m.admin.members
  const a = m.admin.account
  const filter: Filter = FILTERS.includes(sp.status as Filter) ? (sp.status as Filter) : 'all'
  const q = (sp.q ?? '').trim().toUpperCase().replace(/^M-?/, '')
  const page = Math.max(0, Math.min(1000, Number.parseInt(sp.seite ?? '0', 10) || 0))

  const where: SQL[] = []
  if (filter === 'staff') where.push(ne(users.role, 'member'))
  // Gemeldete: einmal die Konten mit offenen Meldungen bestimmen (Index) statt die Zählung für jedes Konto.
  else if (filter === 'reported')
    where.push(sql`${users.id} IN (
      SELECT p.user_id FROM reports r JOIN posts p ON p.id = r.target_id WHERE r.status = 'open' AND r.target_type = 'post'
      UNION SELECT rp.user_id FROM reports r JOIN replies rp ON rp.id = r.target_id WHERE r.status = 'open' AND r.target_type = 'reply')`)
  // Abgelaufene Stummschaltungen zählen als aktiv (zurückgesetzt wird erst beim nächsten Besuch des Mitglieds).
  else if (filter === 'muted') where.push(and(eq(users.status, 'muted'), sql`(${users.mutedUntil} IS NULL OR ${users.mutedUntil} > now())`)!)
  else if (filter === 'active') where.push(or(eq(users.status, 'active'), and(eq(users.status, 'muted'), sql`${users.mutedUntil} <= now()`))!)
  else if (filter !== 'all') where.push(eq(users.status, filter))
  if (q) {
    // Mitglieds-ID steht als Spalte (users.member_ref) – ältere Konten bekommen sie hier nachgetragen.
    await backfillMemberRefs()
    if (!/^[0-9A-F]{1,8}$/.test(q)) where.push(sql`false`)
    else where.push(sql`${users.memberRef} LIKE ${`M-${q}%`}`)
  }

  const rows = await db
    .select({
      id: users.id,
      status: users.status,
      role: users.role,
      mutedUntil: users.mutedUntil,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
      posts: sql<number>`(SELECT count(*)::int FROM posts p WHERE p.user_id = ${users.id} AND p.deleted_at IS NULL)`,
      replies: sql<number>`(SELECT count(*)::int FROM replies r WHERE r.user_id = ${users.id} AND r.deleted_at IS NULL)`,
      reports: openReports,
    })
    .from(users)
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(users.createdAt), desc(users.id))
    .limit(PAGE + 1)
    .offset(page * PAGE)
  const [{ n } = { n: 0 }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(users)
    .where(where.length ? and(...where) : undefined)
  const more = rows.length > PAGE
  const now = new Date()
  const list = rows.slice(0, PAGE).map((u) => (u.status === 'muted' && u.mutedUntil && u.mutedUntil <= now ? { ...u, status: 'active' as const, mutedUntil: null } : u))
  const link = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams()
    const next = { status: filter === 'all' ? undefined : filter, q: sp.q?.trim() || undefined, seite: undefined, ...patch }
    for (const [k, v] of Object.entries(next)) if (v) p.set(k, v)
    return p.size ? `/admin/mitglieder?${p}` : '/admin/mitglieder'
  }
  const label: Record<Filter, string> = {
    all: t.all,
    active: a.statuses.active,
    muted: a.statuses.muted,
    banned: a.statuses.banned,
    deleting: a.statuses.deleting,
    staff: t.staff,
    reported: t.reported,
  }

  return (
    <div className="stack">
      <h1 className="page-title">{t.title}</h1>
      <p className="fine">{t.intro}</p>
      <form className="inline-form" action="/admin/mitglieder" role="search">
        {filter !== 'all' && <input type="hidden" name="status" value={filter} />}
        <input className="input" name="q" defaultValue={sp.q ?? ''} placeholder={t.search} aria-label={t.search} maxLength={20} autoComplete="off" />
        <button className="btn small">{t.searchButton}</button>
      </form>
      <nav className="filter-row" aria-label={t.filter}>
        {FILTERS.map((f) => (
          <Link key={f} href={link({ status: f === 'all' ? undefined : f })} className="chip" aria-current={f === filter ? 'page' : undefined}>
            {label[f]}
          </Link>
        ))}
      </nav>
      <p className="fine" role="status">
        {t.count(n)}
      </p>
      {list.length === 0 ? (
        <p className="notice">{t.empty}</p>
      ) : (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>{m.admin.member}</th>
                <th>{a.status}</th>
                <th>{a.role}</th>
                <th>{a.since}</th>
                <th>{a.lastSeen}</th>
                <th>{a.posts}</th>
                <th>{a.replies}</th>
                <th>{a.openReports}</th>
              </tr>
            </thead>
            <tbody>
              {list.map((u) => (
                <tr key={u.id}>
                  <td>
                    <Link className="member-link" href={`/admin/konto/${encodeURIComponent(memberToken(u.id))}`}>
                      {memberRef(u.id)}
                    </Link>
                  </td>
                  <td>
                    {a.statuses[u.status]}
                    {u.status === 'muted' && u.mutedUntil && (
                      <span className="fine"> · {formatDate(u.mutedUntil, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    )}
                  </td>
                  <td>{a.roles[u.role]}</td>
                  {/* Nur Monat und Jahr bzw. Tag – genug für die Einschätzung, kein genauer Zeitstempel. */}
                  <td>{formatDate(u.createdAt, { month: 'short', year: 'numeric' })}</td>
                  <td>{u.lastLoginAt ? formatDate(u.lastLoginAt, { day: 'numeric', month: 'short', year: 'numeric' }) : t.never}</td>
                  <td>{u.posts}</td>
                  <td>{u.replies}</td>
                  <td>{u.reports > 0 ? <b>{u.reports}</b> : 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {(page > 0 || more) && (
        <div className="row-actions">
          {page > 0 && (
            <Link className="btn ghost small" href={link({ seite: page > 1 ? String(page - 1) : undefined })}>
              ←
            </Link>
          )}
          {more && (
            <Link className="btn ghost small" href={link({ seite: String(page + 1) })}>
              {t.more}
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

/** Konten ohne gespeicherte Mitglieds-ID (vor Migration 0026 angelegt) nachtragen – in Blöcken, einmalig. */
async function backfillMemberRefs() {
  for (;;) {
    const rows = await db.select({ id: users.id }).from(users).where(isNull(users.memberRef)).limit(500)
    if (!rows.length) return
    await db.execute(sql`UPDATE users AS u SET member_ref = v.ref FROM (VALUES ${sql.join(
      rows.map((r) => sql`(${r.id}::uuid, ${memberRef(r.id)})`),
      sql`, `,
    )}) AS v(id, ref) WHERE u.id = v.id`)
  }
}

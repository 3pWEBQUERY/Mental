import { and, asc, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from 'drizzle-orm'
import Link from 'next/link'
import { db } from '@/db'
import { circles, posts } from '@/db/schema'
import { memberFromToken, requireModerator } from '@/lib/server/admin'
import { memberRef } from '@/lib/server/crypto'
import { m } from '@/messages'
import { openReports, when } from './shared'

const PAGE = 25
const STATUS = ['all', 'visible', 'hidden', 'pending', 'worry', 'reported'] as const
type Status = (typeof STATUS)[number]
const STATUS_LABEL: Record<Status, string> = {
  all: 'Alle',
  visible: 'Sichtbar',
  hidden: 'Ausgeblendet',
  pending: 'Wartet auf Prüfung',
  worry: 'Sorge / Krise',
  reported: 'Mit offener Meldung',
}

type Search = Promise<{ status?: string | string[]; kreis?: string | string[]; q?: string | string[]; mitglied?: string | string[]; seite?: string | string[] }>

/**
 * Einträge: alle Gedanken als Liste, neueste zuerst – filtern und durchsuchen. Ein Klick öffnet den Eintrag
 * (/admin/eintraege/<id>) mit Antworten und allen Massnahmen. Nie Benutzernamen, nur die Mitglieds-ID; belastende
 * Inhalte stehen in der Liste nicht im Klartext.
 */
export default async function EntriesPage({ searchParams }: { searchParams: Search }) {
  await requireModerator('mod')
  const raw = await searchParams
  const one = (v: unknown) => (Array.isArray(v) ? v[0] : v) as string | undefined
  const sp = { status: one(raw.status), kreis: one(raw.kreis), q: one(raw.q)?.trim().slice(0, 100), mitglied: one(raw.mitglied), seite: one(raw.seite) }
  const status: Status = STATUS.includes(sp.status as Status) ? (sp.status as Status) : 'all'
  const page = Math.max(0, Math.min(1000, Number.parseInt(sp.seite ?? '0', 10) || 0))
  const memberId = sp.mitglied ? memberFromToken(sp.mitglied) : null

  const circleRows = await db.select({ id: circles.id, slug: circles.slug, name: circles.name, color: circles.color }).from(circles).orderBy(asc(circles.sort))
  const circle = circleRows.find((c) => c.slug === sp.kreis)

  const where: SQL[] = [isNull(posts.deletedAt)]
  if (circle) where.push(eq(posts.circleId, circle.id))
  if (status === 'visible' || status === 'hidden' || status === 'pending') where.push(eq(posts.status, status))
  if (status === 'worry') where.push(inArray(posts.crisisLevel, ['concern', 'acute']))
  if (status === 'reported') where.push(sql`${openReports('post', posts.id)} > 0`)
  if (sp.q) {
    const like = `%${sp.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
    // Treffer im Gedanken selbst oder in einer seiner Antworten.
    where.push(or(ilike(posts.body, like), sql`${posts.id} IN (SELECT rp.post_id FROM replies rp WHERE rp.deleted_at IS NULL AND rp.body ILIKE ${like})`)!)
  }
  if (sp.mitglied) where.push(memberId ? or(eq(posts.userId, memberId), sql`${posts.id} IN (SELECT rp.post_id FROM replies rp WHERE rp.user_id = ${memberId})`)! : sql`false`)

  const rows = await db
    .select({
      id: posts.id,
      userId: posts.userId,
      body: posts.body,
      status: posts.status,
      crisisLevel: posts.crisisLevel,
      contentWarning: posts.contentWarning,
      closed: posts.closed,
      createdAt: posts.createdAt,
      circleName: circles.name,
      circleColor: circles.color,
      circleCw: circles.requireCw,
      reports: openReports('post', posts.id),
      replies: sql<number>`(SELECT count(*)::int FROM replies rp WHERE rp.post_id = ${posts.id} AND rp.deleted_at IS NULL)`,
    })
    .from(posts)
    .innerJoin(circles, eq(circles.id, posts.circleId))
    .where(and(...where))
    .orderBy(desc(posts.createdAt), desc(posts.id))
    .limit(PAGE + 1)
    .offset(page * PAGE)
  const [{ n } = { n: 0 }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(posts)
    .where(and(...where))
  const list = rows.slice(0, PAGE)
  const more = rows.length > PAGE

  const params = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams()
    const base = { status: status === 'all' ? null : status, kreis: circle?.slug ?? null, q: sp.q || null, mitglied: sp.mitglied ?? null, seite: page ? String(page) : null, ...patch }
    for (const [k, v] of Object.entries(base)) if (v) p.set(k, v)
    return p
  }
  const href = (patch: Record<string, string | null>) => {
    const p = params({ seite: null, ...patch })
    return p.size ? `/admin/eintraege?${p}` : '/admin/eintraege'
  }
  // Die Detailseite führt mit denselben Filtern (und derselben Seite) zurück.
  const current = params({}).toString()
  const open = (id: string) => (current ? `/admin/eintraege/${id}?liste=${encodeURIComponent(current)}` : `/admin/eintraege/${id}`)
  const excerpt = (t: string) => (t.length > 160 ? `${t.slice(0, 160).trimEnd()} …` : t)

  return (
    <div className="stack entries">
      <h1 className="page-title">{m.admin.nav.entries}</h1>
      <form className="entries-filter" action="/admin/eintraege">
        <input className="input" type="search" name="q" defaultValue={sp.q} placeholder="Im Text suchen" aria-label="Im Text suchen" maxLength={100} />
        <select className="input" name="kreis" defaultValue={circle?.slug ?? ''} aria-label="Kreis">
          <option value="">Alle Kreise</option>
          {circleRows.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <select className="input" name="status" defaultValue={status} aria-label="Zustand">
          {STATUS.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        {sp.mitglied && <input type="hidden" name="mitglied" value={sp.mitglied} />}
        <button className="btn small">Anzeigen</button>
      </form>
      <p className="fine" role="status">
        {n === 1 ? '1 Gedanke' : `${n} Gedanken`}
        {sp.mitglied && (
          <>
            {' '}
            · nur ein Mitglied ({memberId ? memberRef(memberId) : 'Link abgelaufen'}) · <Link href={href({ mitglied: null })}>alle zeigen</Link>
          </>
        )}
      </p>

      {list.length === 0 ? (
        <p className="notice">Keine Einträge für diese Auswahl.</p>
      ) : (
        <ul className="entry-list">
          {list.map((p) => {
            const heavy = p.crisisLevel !== 'none' || p.contentWarning || p.circleCw
            return (
              <li key={p.id}>
                <Link className="entry-row" href={open(p.id)}>
                  <span className="entry-row-meta">
                    <span className="entry-circle">
                      <span className="dot" style={{ background: p.circleColor }} aria-hidden="true" />
                      {p.circleName}
                    </span>
                    <span>{when(p.createdAt)}</span>
                    <span>
                      {m.admin.member} {memberRef(p.userId)}
                    </span>
                  </span>
                  <span className={heavy ? 'entry-row-text muted' : 'entry-row-text'}>
                    {p.crisisLevel !== 'none' ? 'Krisensprache – im Eintrag ansehen' : heavy ? 'Mit Inhaltshinweis – im Eintrag ansehen' : excerpt(p.body)}
                  </span>
                  <span className="entry-row-badges">
                    {p.status !== 'visible' && <span className={`prio ${p.status === 'pending' ? 'p0' : ''}`}>{m.admin.status[p.status]}</span>}
                    {p.crisisLevel !== 'none' && <span className="prio p0">{p.crisisLevel === 'acute' ? 'Krise (akut)' : 'Sorge'}</span>}
                    {p.reports > 0 && <span className="prio p1">{m.admin.reports(p.reports)}</span>}
                    {p.closed && <span className="prio">geschlossen</span>}
                    <span className="entry-row-count">{p.replies === 1 ? '1 Antwort' : `${p.replies} Antworten`}</span>
                  </span>
                  <svg className="entry-row-go" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
      {(page > 0 || more) && (
        <nav className="row" aria-label="Seiten" style={{ gap: 10 }}>
          {page > 0 && (
            <Link className="btn ghost small" href={href({ seite: page - 1 > 0 ? String(page - 1) : null })}>
              ← Neuere
            </Link>
          )}
          {more && (
            <Link className="btn ghost small" href={href({ seite: String(page + 1) })}>
              Ältere →
            </Link>
          )}
        </nav>
      )}
    </div>
  )
}

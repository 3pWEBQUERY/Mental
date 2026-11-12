import { and, asc, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from 'drizzle-orm'
import Link from 'next/link'
import { db } from '@/db'
import { circles, posts, prompts, replies, users } from '@/db/schema'
import { ModForm } from '@/components/admin/mod-form'
import { Sensitive } from '@/components/admin/sensitive'
import { canModerate, memberFromToken, memberToken, requireModerator } from '@/lib/server/admin'
import { memberRef } from '@/lib/server/crypto'
import { formatDate } from '@/lib/time'
import { m } from '@/messages'
import { manageContent } from '../actions'

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

const openReports = (type: 'post' | 'reply', id: typeof posts.id | typeof replies.id) =>
  sql<number>`(SELECT count(*)::int FROM reports r WHERE r.status = 'open' AND r.target_type = ${type} AND r.target_id = ${id})`

type Search = Promise<{ status?: string | string[]; kreis?: string | string[]; q?: string | string[]; mitglied?: string | string[]; seite?: string | string[] }>

/**
 * Einträge: alle Gedanken samt Antworten, neueste zuerst – filtern, durchsuchen, ansehen und direkt verwalten
 * (ausblenden, wieder zeigen, löschen, Inhaltshinweis, Antworten schliessen; Konto verwarnen, stumm, sperren).
 * Wie überall in der Moderation nie Benutzernamen, nur die Mitglieds-ID.
 */
export default async function EntriesPage({ searchParams }: { searchParams: Search }) {
  const mod = await requireModerator('mod')
  const raw = await searchParams
  const one = (v: unknown) => (Array.isArray(v) ? v[0] : v) as string | undefined
  const sp = { status: one(raw.status), kreis: one(raw.kreis), q: one(raw.q)?.trim().slice(0, 100), mitglied: one(raw.mitglied), seite: one(raw.seite) }
  const status: Status = STATUS.includes(sp.status as Status) ? (sp.status as Status) : 'all'
  const page = Math.max(0, Math.min(1000, Number.parseInt(sp.seite ?? '0', 10) || 0))
  const memberId = sp.mitglied ? memberFromToken(sp.mitglied) : null
  const isAdmin = canModerate(mod, 'admin')
  const a = m.admin.actions

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
      visibility: posts.visibility,
      need: posts.need,
      createdAt: posts.createdAt,
      editedAt: posts.editedAt,
      moderationNote: posts.moderationNote,
      circleName: circles.name,
      circleColor: circles.color,
      circleCw: circles.requireCw,
      prompt: prompts.text,
      role: users.role,
      reports: openReports('post', posts.id),
    })
    .from(posts)
    .innerJoin(circles, eq(circles.id, posts.circleId))
    .innerJoin(users, eq(users.id, posts.userId))
    .leftJoin(prompts, eq(prompts.id, posts.promptId))
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

  const replyRows = list.length
    ? await db
        .select({
          id: replies.id,
          postId: replies.postId,
          userId: replies.userId,
          body: replies.body,
          status: replies.status,
          crisisLevel: replies.crisisLevel,
          isAuthor: replies.isAuthor,
          createdAt: replies.createdAt,
          role: users.role,
          reports: openReports('reply', replies.id),
        })
        .from(replies)
        .leftJoin(users, eq(users.id, replies.userId))
        .where(and(inArray(replies.postId, list.map((p) => p.id)), isNull(replies.deletedAt)))
        .orderBy(asc(replies.createdAt))
    : []

  const href = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams()
    const base = { status: status === 'all' ? null : status, kreis: circle?.slug ?? null, q: sp.q || null, mitglied: sp.mitglied ?? null, seite: null, ...patch }
    for (const [k, v] of Object.entries(base)) if (v) p.set(k, v)
    return p.size ? `/admin/eintraege?${p}` : '/admin/eintraege'
  }
  const memberLink = (userId: string | null) => {
    if (!userId) return <span>{m.admin.member} —</span>
    const token = encodeURIComponent(memberToken(userId))
    return (
      <span className="entry-member">
        <Link className="member-link" href={`/admin/konto/${token}`}>
          {m.admin.member} {memberRef(userId)}
        </Link>
        <Link className="member-link fine" href={href({ mitglied: memberToken(userId) })}>
          alle Einträge
        </Link>
      </span>
    )
  }
  const when = (d: Date) => formatDate(d, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  /** Knöpfe am Konto der Person – Moderationskonten nur verwarnen (und das nur durch Admins). */
  const accountButtons = (userId: string | null, role: string | null) => {
    if (!userId) return null
    if (role && role !== 'member')
      return (
        <>
          {isAdmin && (
            <button className="btn ghost small" name="action" value="warn">
              {a.warn}
            </button>
          )}
          <span className="fine">{m.admin.staffNoBan}</span>
        </>
      )
    return (
      <>
        <button className="btn ghost small" name="action" value="warn">
          {a.warn}
        </button>
        <button className="btn ghost small" name="action" value="mute24">
          {a.mute24}
        </button>
        <button className="btn ghost small" name="action" value="mute7">
          {a.mute7}
        </button>
        <button className="btn ghost small danger" name="action" value="ban">
          {a.ban}
        </button>
      </>
    )
  }
  const confirms = (userId: string | null, what: string) => ({
    delete: { message: `${what} endgültig löschen? Das lässt sich nicht rückgängig machen.`, label: 'Löschen' },
    ...(userId ? { ban: { message: m.admin.account.banConfirm(memberRef(userId)), label: a.ban } } : {}),
  })

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

      {list.length === 0 && <p className="notice">Keine Einträge für diese Auswahl.</p>}
      <ul>
        {list.map((p) => {
          const own = p.userId === mod.userId
          const rs = replyRows.filter((r) => r.postId === p.id)
          const heavy = p.crisisLevel !== 'none' || p.contentWarning || p.circleCw
          const body = <blockquote>{p.body || '—'}</blockquote>
          return (
            <li key={p.id} className="queue-item entry" aria-label={`Gedanke vom ${when(p.createdAt)}`}>
              <div className="top">
                <span className="entry-circle">
                  <span className="dot" style={{ background: p.circleColor }} aria-hidden="true" />
                  {p.circleName}
                </span>
                <span>{when(p.createdAt)}</span>
                {memberLink(p.userId)}
                <span>{p.visibility === 'anonymous' ? 'anonym geteilt' : 'unter Anzeigename'}</span>
                <span>{m.needs[p.need]}</span>
              </div>
              <div className="entry-badges">
                {p.status !== 'visible' && <span className={`prio ${p.status === 'pending' ? 'p0' : ''}`}>{m.admin.status[p.status]}</span>}
                {p.crisisLevel !== 'none' && <span className="prio p0">{p.crisisLevel === 'acute' ? 'Krise (akut)' : 'Sorge'}</span>}
                {(p.contentWarning || p.circleCw) && <span className="prio">Inhaltshinweis</span>}
                {p.closed && <span className="prio">Antworten geschlossen</span>}
                {p.reports > 0 && <span className="prio p1">{m.admin.reports(p.reports)}</span>}
                {p.editedAt && <span className="prio">bearbeitet</span>}
              </div>
              {p.prompt && <p className="post-prompt">Zur Frage vom Team <q>{p.prompt}</q></p>}
              {heavy ? <Sensitive label={p.crisisLevel !== 'none' ? 'Krisensprache' : 'Inhaltshinweis'}>{body}</Sensitive> : body}
              {p.moderationNote && <p className="fine">Begründung beim Ausblenden: «{p.moderationNote}»</p>}

              {own ? (
                <p className="fine">{m.admin.ownCase}</p>
              ) : (
                <ModForm action={manageContent} className="inline-form" label="Gedanke verwalten" confirm={confirms(p.userId, 'Diesen Gedanken samt Antworten')}>
                  <input type="hidden" name="targetType" value="post" />
                  <input type="hidden" name="targetId" value={p.id} />
                  <input className="input" name="reason" placeholder={m.admin.reason} maxLength={500} aria-label={m.admin.reason} list="mod-templates" />
                  {p.status === 'visible' ? (
                    <button className="btn ghost small" name="action" value="hide">
                      {a.hide}
                    </button>
                  ) : (
                    <button className="btn small" name="action" value="show">
                      Wieder zeigen
                    </button>
                  )}
                  <button className="btn ghost small" name="action" value={p.contentWarning ? 'cw-off' : 'cw-on'} disabled={p.circleCw}>
                    {p.contentWarning || p.circleCw ? 'Inhaltshinweis aus' : 'Inhaltshinweis an'}
                  </button>
                  <button className="btn ghost small" name="action" value={p.closed ? 'open' : 'close'}>
                    {p.closed ? 'Antworten öffnen' : 'Antworten schliessen'}
                  </button>
                  <button className="btn ghost small danger" name="action" value="delete">
                    Löschen
                  </button>
                  <span className="entry-sep" aria-hidden="true" />
                  {accountButtons(p.userId, p.role)}
                </ModForm>
              )}

              {rs.length > 0 && (
                <details className="entry-replies">
                  <summary>{rs.length === 1 ? '1 Antwort' : `${rs.length} Antworten`}</summary>
                  <ul>
                    {rs.map((r) => (
                      <li key={r.id} aria-label={`Antwort vom ${when(r.createdAt)}`}>
                        <div className="top">
                          {memberLink(r.userId)}
                          {r.isAuthor && <span>Verfasser:in des Gedankens</span>}
                          <span>{when(r.createdAt)}</span>
                          {r.status !== 'visible' && <span className="prio">{m.admin.status[r.status]}</span>}
                          {r.crisisLevel !== 'none' && <span className="prio p0">{r.crisisLevel === 'acute' ? 'Krise (akut)' : 'Sorge'}</span>}
                          {r.reports > 0 && <span className="prio p1">{m.admin.reports(r.reports)}</span>}
                        </div>
                        <p className="entry-reply-body">{r.body || '—'}</p>
                        {r.userId === mod.userId ? (
                          <p className="fine">{m.admin.ownCase}</p>
                        ) : (
                          <ModForm action={manageContent} className="inline-form" label="Antwort verwalten" confirm={confirms(r.userId, 'Diese Antwort')}>
                            <input type="hidden" name="targetType" value="reply" />
                            <input type="hidden" name="targetId" value={r.id} />
                            <input className="input" name="reason" placeholder={m.admin.reason} maxLength={500} aria-label={m.admin.reason} list="mod-templates" />
                            {r.status === 'visible' ? (
                              <button className="btn ghost small" name="action" value="hide">
                                {a.hide}
                              </button>
                            ) : (
                              <button className="btn small" name="action" value="show">
                                Wieder zeigen
                              </button>
                            )}
                            <button className="btn ghost small danger" name="action" value="delete">
                              Löschen
                            </button>
                            <span className="entry-sep" aria-hidden="true" />
                            {accountButtons(r.userId, r.role)}
                          </ModForm>
                        )}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </li>
          )
        })}
      </ul>
      <datalist id="mod-templates">
        {m.admin.templates.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
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

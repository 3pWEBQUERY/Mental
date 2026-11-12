import { and, asc, eq, isNull } from 'drizzle-orm'
import Link from 'next/link'
import { z } from 'zod'
import { db } from '@/db'
import { circles, posts, prompts, replies, users } from '@/db/schema'
import { ModForm } from '@/components/admin/mod-form'
import { Sensitive } from '@/components/admin/sensitive'
import { canModerate, requireModerator } from '@/lib/server/admin'
import { m } from '@/messages'
import { manageContent } from '../../actions'
import { AccountButtons, confirms, MemberLink, openReports, Templates, when } from '../shared'

const LIST_KEYS = ['status', 'kreis', 'q', 'mitglied', 'seite'] as const

/** Zurück zur Liste mit denselben Filtern – nur bekannte Parameter, nie eine fremde Adresse. */
function backHref(raw: string | undefined) {
  const p = new URLSearchParams()
  const from = new URLSearchParams(raw ?? '')
  for (const k of LIST_KEYS) {
    const v = from.get(k)
    if (v) p.set(k, v.slice(0, 400))
  }
  return p.size ? `/admin/eintraege?${p}` : '/admin/eintraege'
}

/**
 * Ein Eintrag im Detail: der ganze Gedanke, alle Antworten und alle Massnahmen – am Inhalt (ausblenden, wieder zeigen,
 * löschen, Inhaltshinweis, Antworten schliessen) und am Konto (verwarnen, stumm, sperren). Nur die Mitglieds-ID.
 */
export default async function EntryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ liste?: string | string[] }> }) {
  const mod = await requireModerator('mod')
  const { id } = await params
  const sp = await searchParams
  const back = backHref(Array.isArray(sp.liste) ? sp.liste[0] : sp.liste)
  const isAdmin = canModerate(mod, 'admin')
  const a = m.admin.actions
  const backLink = (
    <Link className="back-link" href={back}>
      ← Zur Liste
    </Link>
  )

  const valid = z.uuid().safeParse(id).success
  const [p] = valid
    ? await db
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
        .where(and(eq(posts.id, id), isNull(posts.deletedAt)))
    : []
  if (!p)
    return (
      <div className="stack">
        {backLink}
        <p className="notice">Diesen Eintrag gibt es nicht mehr – er wurde gelöscht.</p>
      </div>
    )

  const rs = await db
    .select({
      id: replies.id,
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
    .where(and(eq(replies.postId, p.id), isNull(replies.deletedAt)))
    .orderBy(asc(replies.createdAt))

  const own = p.userId === mod.userId
  const heavy = p.crisisLevel !== 'none' || p.contentWarning || p.circleCw
  const body = <blockquote>{p.body || '—'}</blockquote>
  return (
    <div className="stack entry-detail">
      {backLink}
      <article className="queue-item entry" aria-label={`Gedanke vom ${when(p.createdAt)}`}>
        <h1 className="page-title">Gedanke</h1>
        <div className="top">
          <span className="entry-circle">
            <span className="dot" style={{ background: p.circleColor }} aria-hidden="true" />
            {p.circleName}
          </span>
          <span>{when(p.createdAt)}</span>
          <MemberLink userId={p.userId} />
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
        {p.prompt && (
          <p className="post-prompt">
            Zur Frage vom Team <q>{p.prompt}</q>
          </p>
        )}
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
            <AccountButtons userId={p.userId} role={p.role} isAdmin={isAdmin} />
          </ModForm>
        )}
      </article>

      <section className="entry-replies" aria-labelledby="antworten">
        <h2 id="antworten" className="eyebrow">
          {rs.length === 0 ? 'Noch keine Antworten' : rs.length === 1 ? '1 Antwort' : `${rs.length} Antworten`}
        </h2>
        <ul>
          {rs.map((r) => (
            <li key={r.id} aria-label={`Antwort vom ${when(r.createdAt)}`}>
              <div className="top">
                <MemberLink userId={r.userId} />
                {r.isAuthor && <span>Verfasser:in des Gedankens</span>}
                <span>{when(r.createdAt)}</span>
                {r.status !== 'visible' && <span className="prio">{m.admin.status[r.status]}</span>}
                {r.crisisLevel !== 'none' && <span className="prio p0">{r.crisisLevel === 'acute' ? 'Krise (akut)' : 'Sorge'}</span>}
                {r.reports > 0 && <span className="prio p1">{m.admin.reports(r.reports)}</span>}
              </div>
              {r.crisisLevel !== 'none' ? (
                <Sensitive label="Krisensprache">
                  <p className="entry-reply-body">{r.body || '—'}</p>
                </Sensitive>
              ) : (
                <p className="entry-reply-body">{r.body || '—'}</p>
              )}
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
                  <AccountButtons userId={r.userId} role={r.role} isAdmin={isAdmin} />
                </ModForm>
              )}
            </li>
          ))}
        </ul>
      </section>
      <Templates />
    </div>
  )
}

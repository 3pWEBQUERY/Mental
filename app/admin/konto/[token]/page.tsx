import { and, count, desc, eq, inArray, isNull, or } from 'drizzle-orm'
import { db } from '@/db'
import { moderationActions, posts, replies, users } from '@/db/schema'
import { canModerate, memberFromToken, memberToken, requireModerator } from '@/lib/server/admin'
import { memberRef } from '@/lib/server/crypto'
import { formatDate } from '@/lib/time'
import { m } from '@/messages'
import { restoreAccount } from '../../actions'

/**
 * Kontoseite in der Moderation: Status, Rolle, bisherige Massnahmen (am Konto und an seinen Inhalten) und das
 * Aufheben von Stummschaltung oder Sperre. Nie der Benutzername – nur die Mitglieds-ID.
 */
export default async function AccountPage({ params }: { params: Promise<{ token: string }> }) {
  const mod = await requireModerator('mod')
  const { token } = await params
  const userId = memberFromToken(decodeURIComponent(token))
  const t = m.admin.account
  if (!userId) return <p className="notice">{t.expired}</p>
  const [u] = await db
    .select({ status: users.status, role: users.role, mutedUntil: users.mutedUntil, createdAt: users.createdAt })
    .from(users)
    .where(eq(users.id, userId))
  if (!u) return <p className="notice">{t.expired}</p>
  const ref = memberRef(userId)
  const [[{ p } = { p: 0 }], [{ r } = { r: 0 }], history] = await Promise.all([
    db
      .select({ p: count() })
      .from(posts)
      .where(and(eq(posts.userId, userId), isNull(posts.deletedAt))),
    db
      .select({ r: count() })
      .from(replies)
      .where(and(eq(replies.userId, userId), isNull(replies.deletedAt))),
    db
      .select()
      .from(moderationActions)
      .where(
        or(
          and(eq(moderationActions.targetType, 'user'), eq(moderationActions.targetId, userId)),
          and(
            eq(moderationActions.targetType, 'post'),
            inArray(moderationActions.targetId, db.select({ id: posts.id }).from(posts).where(eq(posts.userId, userId))),
          ),
          and(
            eq(moderationActions.targetType, 'reply'),
            inArray(moderationActions.targetId, db.select({ id: replies.id }).from(replies).where(eq(replies.userId, userId))),
          ),
        ),
      )
      .orderBy(desc(moderationActions.createdAt))
      .limit(100),
  ])
  const isAdmin = canModerate(mod, 'admin')
  const tok = memberToken(userId)
  return (
    <div className="stack">
      <h1 className="page-title">{t.title(ref)}</h1>
      <dl className="facts">
        <div>
          <dt>{t.status}</dt>
          <dd>{t.statuses[u.status]}</dd>
        </div>
        {u.status === 'muted' && u.mutedUntil && (
          <div>
            <dt>{t.mutedUntil}</dt>
            <dd>{formatDate(u.mutedUntil, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</dd>
          </div>
        )}
        <div>
          <dt>{t.role}</dt>
          <dd>{t.roles[u.role]}</dd>
        </div>
        <div>
          <dt>{t.since}</dt>
          {/* Nur Monat und Jahr – genug für die Einschätzung, kein genauer Zeitstempel. */}
          <dd>{formatDate(u.createdAt, { month: 'long', year: 'numeric' })}</dd>
        </div>
        <div>
          <dt>{t.posts}</dt>
          <dd>{p}</dd>
        </div>
        <div>
          <dt>{t.replies}</dt>
          <dd>{r}</dd>
        </div>
      </dl>

      {(u.status === 'muted' || (u.status === 'banned' && isAdmin)) && (
        <form action={restoreAccount} className="inline-form">
          <input type="hidden" name="token" value={tok} />
          <input className="input" name="reason" placeholder={m.admin.reason} maxLength={500} aria-label={m.admin.reason} />
          {u.status === 'muted' && (
            <button className="btn small" name="action" value="unmute">
              {t.unmute}
            </button>
          )}
          {u.status === 'banned' && isAdmin && (
            <button className="btn small" name="action" value="unban">
              {t.unban}
            </button>
          )}
        </form>
      )}

      <h2 className="section-title">{t.history}</h2>
      {history.length === 0 ? (
        <p className="fine">{t.historyEmpty}</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Zeit</th>
              <th>Moderation</th>
              <th>Aktion</th>
              <th>Ziel</th>
              <th>Begründung</th>
            </tr>
          </thead>
          <tbody>
            {history.map((h) => (
              <tr key={h.id}>
                <td>{formatDate(h.createdAt, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                <td>{h.moderatorId ? memberRef(h.moderatorId) : 'System'}</td>
                <td>{h.action}</td>
                <td>{m.admin.targetType[h.targetType]}</td>
                <td>{h.reason ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

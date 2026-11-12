import { and, count, desc, eq, inArray, isNull, or } from 'drizzle-orm'
import { db } from '@/db'
import { moderationActions, posts, replies, roleProposals, users } from '@/db/schema'
import { canModerate, memberFromToken, memberToken, requireModerator, ROLE_PROPOSAL_DAYS } from '@/lib/server/admin'
import { memberRef, staffRef } from '@/lib/server/crypto'
import { formatDate } from '@/lib/time'
import { m } from '@/messages'
import { AdminForm } from '@/components/admin/admin-form'
import { decideRole, moderateAccount, proposeRole, restoreAccount } from '../../actions'
import { ModForm } from '@/components/admin/mod-form'
import { auditLabel } from '@/lib/audit-label'
import Link from 'next/link'

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
    .select({ status: users.status, role: users.role, mutedUntil: users.mutedUntil, createdAt: users.createdAt, lastLoginAt: users.lastLoginAt })
    .from(users)
    .where(eq(users.id, userId))
  if (!u) return <p className="notice">{t.expired}</p>
  // Abgelaufene Stummschaltung: gilt schon nicht mehr (zurückgesetzt wird sie beim nächsten Besuch des Mitglieds).
  if (u.status === 'muted' && u.mutedUntil && u.mutedUntil <= new Date()) Object.assign(u, { status: 'active' as const, mutedUntil: null })
  const ref = memberRef(userId)
  const [[{ p } = { p: 0 }], [{ r } = { r: 0 }], history, [proposal]] = await Promise.all([
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
    db.select().from(roleProposals).where(eq(roleProposals.userId, userId)),
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
          <dt>{t.lastSeen}</dt>
          <dd>{u.lastLoginAt ? formatDate(u.lastLoginAt, { day: 'numeric', month: 'short', year: 'numeric' }) : m.admin.members.never}</dd>
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
      {p + r > 0 && (
        <p>
          <Link className="btn ghost small" href={`/admin/eintraege?mitglied=${encodeURIComponent(tok)}`}>
            Einträge dieses Mitglieds ansehen
          </Link>
        </p>
      )}

      {userId === mod.userId ? (
        <p className="fine">{t.self}</p>
      ) : (u.status === 'active' || u.status === 'muted') && (u.role === 'member' || isAdmin) ? (
        <section className="stack" style={{ gap: 10 }} aria-labelledby="sanction-title">
          <h2 id="sanction-title" className="section-title">
            {t.actionsTitle}
          </h2>
          <p className="fine">{t.actionsIntro}</p>
          {/* Moderationskonten nie stumm oder gesperrt – erst über «Rollen» herabstufen (Vier-Augen-Prinzip). */}
          {u.role !== 'member' && <p className="fine">{m.admin.staffNoBan}</p>}
          <AdminForm
            action={moderateAccount}
            className="inline-form"
            label={t.actionsTitle}
            resetOnSuccess
            confirm={{ ban: { message: t.banConfirm(ref), label: m.admin.actions.ban } }}
          >
            <input type="hidden" name="token" value={tok} />
            <input className="input" name="reason" placeholder={m.admin.reason} maxLength={500} aria-label={m.admin.reason} />
            <button className="btn ghost small" name="action" value="warn">
              {m.admin.actions.warn}
            </button>
            {u.role === 'member' && (
              <>
                <button className="btn ghost small" name="action" value="mute24">
                  {m.admin.actions.mute24}
                </button>
                <button className="btn ghost small" name="action" value="mute7">
                  {m.admin.actions.mute7}
                </button>
                <button className="btn ghost small danger" name="action" value="ban">
                  {m.admin.actions.ban}
                </button>
              </>
            )}
            {u.role === 'member' && (
              <button className="btn ghost small" name="action" value="logout">
                {t.logout}
              </button>
            )}
          </AdminForm>
        </section>
      ) : null}

      {(u.status === 'muted' || (u.status === 'banned' && isAdmin)) && (
        <ModForm action={restoreAccount} className="inline-form">
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
        </ModForm>
      )}

      {isAdmin && (
        <section aria-labelledby="role-title" className="stack" style={{ gap: 10 }}>
          <h2 id="role-title" className="section-title">
            {m.admin.roles.title}
          </h2>
          {proposal ? (
            <div className="card stack" style={{ gap: 8 }}>
              <p>
                {m.admin.roles.pending(
                  t.roles[proposal.role],
                  // Wer vorschlägt, ist Team: Team-Kürzel wie im Protokoll, nicht die Mitglieds-ID.
                  staffRef(proposal.proposedBy),
                  formatDate(proposal.createdAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
                )}
              </p>
              {proposal.reason && (
                <p className="fine">
                  {m.admin.roles.pendingReason}: {proposal.reason}
                </p>
              )}
              {proposal.createdAt.getTime() < Date.now() - ROLE_PROPOSAL_DAYS * 86_400_000 && <p className="fine">{m.admin.roles.expiredHint}</p>}
              {proposal.proposedBy === mod.userId && <p className="fine">{m.admin.roles.ownProposal}</p>}
              {/* Über das eigene Konto entscheiden immer andere Admins (decideRole). */}
              {userId === mod.userId ? (
                <p className="fine">{m.admin.roles.ownAccount}</p>
              ) : (
                <ModForm action={decideRole} className="inline-form">
                  <input type="hidden" name="token" value={tok} />
                  <input type="hidden" name="role" value={proposal.role} />
                  <input type="hidden" name="at" value={proposal.createdAt.toISOString()} />
                  {proposal.proposedBy !== mod.userId && (
                    <button className="btn small" name="decision" value="accept">
                      {m.admin.roles.accept}
                    </button>
                  )}
                  <button className="btn ghost small" name="decision" value="reject">
                    {proposal.proposedBy === mod.userId ? m.admin.roles.withdraw : m.admin.roles.reject}
                  </button>
                </ModForm>
              )}
            </div>
          ) : userId !== mod.userId ? (
            <ModForm action={proposeRole} className="inline-form">
              <p className="fine" style={{ flexBasis: '100%', maxWidth: 640 }}>
                {m.admin.roles.intro}
              </p>
              <input type="hidden" name="token" value={tok} />
              <select className="input" name="role" defaultValue={u.role} aria-label={m.admin.roles.newRole} style={{ width: 'auto' }}>
                {(['member', 'peer_mod', 'mod', 'admin'] as const).map((role) => (
                  <option key={role} value={role}>
                    {t.roles[role]}
                  </option>
                ))}
              </select>
              <input className="input" name="reason" required minLength={3} maxLength={500} placeholder={m.admin.roles.reason} aria-label={m.admin.roles.reason} />
              <button className="btn small">{m.admin.roles.propose}</button>
            </ModForm>
          ) : null}
        </section>
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
                <td>{h.moderatorId ? staffRef(h.moderatorId) : 'System'}</td>
                <td>{auditLabel(h.action)}</td>
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

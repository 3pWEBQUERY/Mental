import { and, asc, eq, inArray, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import { caseClaims, posts, replies, reports } from '@/db/schema'
import { canModerate, memberToken, requireModerator } from '@/lib/server/admin'
import { memberRef } from '@/lib/server/crypto'
import { formatDate, relativeTime } from '@/lib/time'
import { m } from '@/messages'
import { Sensitive } from '@/components/admin/sensitive'
import Link from 'next/link'
import { claimCase, moderate, resolveAppeal } from './actions'

/** Frist für akute Hinweise – danach erscheint «überfällig» (und der Monitor erinnert das Team). */
const ACUTE_SLA_MS = 30 * 60_000
/** Gleich wie in actions.ts: so lange gilt eine Übernahme. */
const CLAIM_MS = 20 * 60_000

const REASON_LABEL: Record<string, string> = {
  ...m.report.reasons,
  auto_acute: m.admin.autoAcute,
  auto_flag: m.admin.autoFlag,
}

/**
 * Warteschlange: «acute» vor Meldungen vor automatischen Treffern.
 * Moderator:innen sehen nur den Inhalt und eine nicht rückführbare Mitglieds-ID – nie den Benutzernamen.
 */
export default async function QueuePage() {
  const mod = await requireModerator('peer')
  // Nur Meldungen, deren Inhalt es noch gibt – verwaiste Meldungen dürfen keine Plätze vor akuten Fällen belegen.
  const open = await db
    .select()
    .from(reports)
    .where(
      and(
        eq(reports.status, 'open'),
        or(
          and(eq(reports.targetType, 'post'), sql`EXISTS (SELECT 1 FROM posts p WHERE p.id = ${reports.targetId})`),
          and(eq(reports.targetType, 'reply'), sql`EXISTS (SELECT 1 FROM replies r WHERE r.id = ${reports.targetId})`),
        ),
      ),
    )
    .orderBy(asc(reports.priority), asc(reports.createdAt))
    .limit(400)

  const groups = new Map<string, { type: 'post' | 'reply'; id: string; priority: number; first: Date; items: typeof open }>()
  for (const r of open) {
    if (r.targetType === 'user') continue
    const key = `${r.targetType}:${r.targetId}`
    const g = groups.get(key) ?? { type: r.targetType, id: r.targetId, priority: r.priority, first: r.createdAt, items: [] }
    g.priority = Math.min(g.priority, r.priority)
    g.items.push(r)
    groups.set(key, g)
  }
  const list = [...groups.values()].sort((a, b) => a.priority - b.priority || a.first.getTime() - b.first.getTime())
  const postIds = list.filter((g) => g.type === 'post').map((g) => g.id)
  const replyIds = list.filter((g) => g.type === 'reply').map((g) => g.id)
  const [postRows, replyRows, claims] = await Promise.all([
    postIds.length ? db.select().from(posts).where(inArray(posts.id, postIds)) : [],
    replyIds.length ? db.select().from(replies).where(inArray(replies.id, replyIds)) : [],
    list.length ? db.select().from(caseClaims).where(inArray(caseClaims.targetId, [...postIds, ...replyIds])) : [],
  ])
  const isMod = canModerate(mod, 'mod')
  const a = m.admin.actions
  // Einsprüche gegen Massnahmen – nur für die Moderation (mod), nicht für Peers.
  const appeals = isMod
    ? await db
        .select()
        .from(reports)
        .where(and(eq(reports.status, 'open'), eq(reports.targetType, 'user'), sql`EXISTS (SELECT 1 FROM users u WHERE u.id = ${reports.targetId})`))
        .orderBy(asc(reports.createdAt))
        .limit(50)
    : []
  const now = Date.now()

  const appealList = appeals.length > 0 && (
    <section className="stack" style={{ gap: 0, marginBottom: 28 }} aria-label={m.admin.appeals}>
      <h2 className="section-title">{m.admin.appeals}</h2>
      <p className="fine">{m.admin.appealHint}</p>
      <ul>
        {appeals.map((ap) => (
          <li key={ap.id} className="queue-item">
            <div className="top">
              <span className="prio">{m.admin.appealFrom}</span>
              <Link className="member-link" href={`/admin/konto/${encodeURIComponent(memberToken(ap.targetId))}`}>
                {m.admin.member} {memberRef(ap.targetId)}
              </Link>
              <span>{relativeTime(ap.createdAt)}</span>
            </div>
            <blockquote>{ap.note || '—'}</blockquote>
            <form action={resolveAppeal} className="inline-form">
              <input type="hidden" name="reportId" value={ap.id} />
              <input className="input" name="reason" placeholder={m.admin.reason} maxLength={500} aria-label={m.admin.reason} />
              <button className="btn small" name="decision" value="accept">
                {m.admin.appealAccept}
              </button>
              <button className="btn ghost small" name="decision" value="reject">
                {m.admin.appealReject}
              </button>
            </form>
          </li>
        ))}
      </ul>
    </section>
  )

  const title = <h1 className="sr-only">{m.admin.nav.queue}</h1>
  if (!list.length)
    return (
      <>
        {title}
        {appealList}
        <p className="notice">{m.admin.queueEmpty}</p>
      </>
    )
  return (
    <>
      {title}
      {appealList}
      <ul>
        <datalist id="mod-templates">
          {m.admin.templates.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
        {list.map((g) => {
          const content = g.type === 'post' ? postRows.find((p) => p.id === g.id) : replyRows.find((r) => r.id === g.id)
          if (!content) return null
          const authorRef = content.userId ? memberRef(content.userId) : '—'
          const counts = g.items.reduce<Record<string, number>>((acc, r) => ((acc[r.reason] = (acc[r.reason] ?? 0) + 1), acc), {})
          return (
            <li key={`${g.type}:${g.id}`} className="queue-item">
              <div className="top">
                <span className={`prio p${g.priority}`}>{m.admin.priority[g.priority]}</span>
                {g.priority === 0 && now - g.first.getTime() > ACUTE_SLA_MS && <span className="prio overdue">{m.admin.overdue}</span>}
                <span>{m.admin.targetType[g.type]}</span>
                {isMod && content.userId ? (
                  <Link className="member-link" href={`/admin/konto/${encodeURIComponent(memberToken(content.userId))}`}>
                    {m.admin.member} {authorRef}
                  </Link>
                ) : (
                  <span>
                    {m.admin.member} {authorRef}
                  </span>
                )}
                <span>{m.admin.status[content.status]}</span>
                <span>{relativeTime(content.createdAt)}</span>
              </div>
              {g.priority <= 1 ? (
                <Sensitive label={m.admin.priority[g.priority]!}>
                  <blockquote>{content.body || '—'}</blockquote>
                </Sensitive>
              ) : (
                <blockquote>{content.body || '—'}</blockquote>
              )}
              <div className="reasons-list">
                {Object.entries(counts).map(([reason, n]) => (
                  <span key={reason} style={{ marginRight: 14 }}>
                    {REASON_LABEL[reason] ?? reason} ×{n}
                  </span>
                ))}
                {g.items
                  .filter((r) => r.note)
                  .map((r) => (
                    <p key={r.id} className="fine">
                      «{r.note}» · {formatDate(r.createdAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  ))}
              </div>
              {(() => {
                const c = claims.find((x) => x.targetType === g.type && x.targetId === g.id && now - x.claimedAt.getTime() < CLAIM_MS)
                if (c && c.userId === mod.userId) return <p className="claim mine">{m.admin.claim.mine}</p>
                if (c) return <p className="claim">{m.admin.claim.other(memberRef(c.userId), relativeTime(c.claimedAt))}</p>
                return (
                  <form action={claimCase}>
                    <input type="hidden" name="targetType" value={g.type} />
                    <input type="hidden" name="targetId" value={g.id} />
                    <button className="btn ghost small">{m.admin.claim.take}</button>
                  </form>
                )
              })()}
              <form action={moderate} className="inline-form">
                <input type="hidden" name="targetType" value={g.type} />
                <input type="hidden" name="targetId" value={g.id} />
                <input className="input" name="reason" placeholder={m.admin.reason} maxLength={500} aria-label={m.admin.reason} list="mod-templates" />
                {isMod && (
                  <button className="btn small" name="action" value="approve">
                    {a.approve}
                  </button>
                )}
                {isMod && (g.priority <= 1 || g.items.some((r) => r.reason === 'worry')) && (
                  <button className="btn ghost small" name="action" value="care">
                    {a.care}
                  </button>
                )}
                <button className="btn ghost small" name="action" value="hide">
                  {a.hide}
                </button>
                {g.type === 'post' && (
                  <button className="btn ghost small" name="action" value="cw">
                    {a.cw}
                  </button>
                )}
                {isMod && (
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
                    <button className="btn ghost small" name="action" value="dismiss">
                      {a.dismiss}
                    </button>
                  </>
                )}
              </form>
            </li>
          )
        })}
      </ul>
    </>
  )
}

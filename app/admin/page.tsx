import { asc, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { posts, replies, reports } from '@/db/schema'
import { canModerate, requireModerator } from '@/lib/server/admin'
import { memberRef } from '@/lib/server/crypto'
import { formatDate, relativeTime } from '@/lib/time'
import { m } from '@/messages'
import { moderate } from './actions'

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
  const open = await db.select().from(reports).where(eq(reports.status, 'open')).orderBy(asc(reports.priority), asc(reports.createdAt)).limit(400)

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
  const [postRows, replyRows] = await Promise.all([
    postIds.length ? db.select().from(posts).where(inArray(posts.id, postIds)) : [],
    replyIds.length ? db.select().from(replies).where(inArray(replies.id, replyIds)) : [],
  ])
  const isMod = canModerate(mod, 'mod')
  const a = m.admin.actions

  if (!list.length) return <p className="notice">{m.admin.queueEmpty}</p>
  return (
    <ul>
      {list.map((g) => {
        const content = g.type === 'post' ? postRows.find((p) => p.id === g.id) : replyRows.find((r) => r.id === g.id)
        if (!content) return null
        const authorRef = content.userId ? memberRef(content.userId) : '—'
        const counts = g.items.reduce<Record<string, number>>((acc, r) => ((acc[r.reason] = (acc[r.reason] ?? 0) + 1), acc), {})
        return (
          <li key={`${g.type}:${g.id}`} className="queue-item">
            <div className="top">
              <span className={`prio p${g.priority}`}>{m.admin.priority[g.priority]}</span>
              <span>{m.admin.targetType[g.type]}</span>
              <span>
                {m.admin.member} {authorRef}
              </span>
              <span>{m.admin.status[content.status]}</span>
              <span>{relativeTime(content.createdAt)}</span>
            </div>
            <blockquote>{content.body || '—'}</blockquote>
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
            <form action={moderate} className="inline-form">
              <input type="hidden" name="targetType" value={g.type} />
              <input type="hidden" name="targetId" value={g.id} />
              <input className="input" name="reason" placeholder={m.admin.reason} maxLength={500} aria-label={m.admin.reason} />
              {isMod && (
                <button className="btn small" name="action" value="approve">
                  {a.approve}
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
  )
}


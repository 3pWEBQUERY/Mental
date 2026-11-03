import { desc } from 'drizzle-orm'
import { db } from '@/db'
import { moderationActions } from '@/db/schema'
import Link from 'next/link'
import { memberToken, requireModerator } from '@/lib/server/admin'
import { memberRef, staffRef } from '@/lib/server/crypto'
import { formatDate } from '@/lib/time'
import { auditLabel } from '@/lib/audit-label'
import { m } from '@/messages'

/** Unveränderliches Audit-Log (ein Datenbank-Trigger verhindert Änderungen). */
export default async function AuditPage() {
  await requireModerator('mod')
  const rows = await db.select().from(moderationActions).orderBy(desc(moderationActions.createdAt)).limit(300)
  return (
    <div className="stack">
      <h1 className="page-title">{m.admin.nav.audit}</h1>
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
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{formatDate(r.createdAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
              <td>{r.moderatorId ? staffRef(r.moderatorId) : 'System'}</td>
              <td>{auditLabel(r.action)}</td>
              <td>
                {m.admin.targetType[r.targetType as 'post' | 'reply' | 'user'] ?? r.targetType}{' '}
                {r.targetType === 'user' ? (
                  <Link href={`/admin/konto/${encodeURIComponent(memberToken(r.targetId))}`}>{memberRef(r.targetId)}</Link>
                ) : (
                  r.targetId.slice(0, 8)
                )}
              </td>
              <td>{r.reason ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

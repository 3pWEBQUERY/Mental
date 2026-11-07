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
const PAGE = 100

/** Seitenweise (?seite=N): Ältere Einträge blieben sonst ab Nr. 300 unerreichbar. */
export default async function AuditPage({ searchParams }: { searchParams: Promise<{ seite?: string | string[] }> }) {
  await requireModerator('mod')
  const raw = (await searchParams).seite
  const page = Math.max(0, Math.min(10_000, Number.parseInt((Array.isArray(raw) ? raw[0] : raw) ?? '0', 10) || 0))
  const found = await db
    .select()
    .from(moderationActions)
    .orderBy(desc(moderationActions.createdAt), desc(moderationActions.id))
    .limit(PAGE + 1)
    .offset(page * PAGE)
  const more = found.length > PAGE
  const rows = found.slice(0, PAGE)
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
                {/* Eigene Aktionen (z. B. Vorschlag zurückziehen): nur das Team-Kürzel, sonst stünde es neben der Mitglieds-ID. */}
                {r.targetType === 'user' && r.targetId === r.moderatorId ? (
                  staffRef(r.targetId)
                ) : r.targetType === 'user' ? (
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
      {(page > 0 || more) && (
        <div className="row-actions">
          {page > 0 && (
            <Link className="btn ghost small" href={page > 1 ? `/admin/audit?seite=${page - 1}` : '/admin/audit'}>
              ←
            </Link>
          )}
          {more && (
            <Link className="btn ghost small" href={`/admin/audit?seite=${page + 1}`}>
              {m.admin.members.more}
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

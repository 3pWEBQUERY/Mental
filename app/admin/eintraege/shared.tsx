import Link from 'next/link'
import { sql } from 'drizzle-orm'
import { posts, replies } from '@/db/schema'
import { memberToken } from '@/lib/server/admin'
import { memberRef } from '@/lib/server/crypto'
import { formatDate } from '@/lib/time'
import { m } from '@/messages'

/** Offene Meldungen zu einem Inhalt (die Abfragen haben Joins – die Spalte steht dann mit Tabellennamen). */
export const openReports = (type: 'post' | 'reply', id: typeof posts.id | typeof replies.id) =>
  sql<number>`(SELECT count(*)::int FROM reports r WHERE r.status = 'open' AND r.target_type = ${type} AND r.target_id = ${id})`

export const when = (d: Date) => formatDate(d, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

/** Mitglieds-ID mit Link zur Kontoseite (dort auch Stummschaltung/Sperre aufheben) und zu allen Einträgen. Nie der Benutzername. */
export function MemberLink({ userId, withEntries = true }: { userId: string | null; withEntries?: boolean }) {
  if (!userId) return <span>{m.admin.member} —</span>
  const token = memberToken(userId)
  return (
    <span className="entry-member">
      <Link className="member-link" href={`/admin/konto/${encodeURIComponent(token)}`}>
        {m.admin.member} {memberRef(userId)}
      </Link>
      {withEntries && (
        <Link className="member-link fine" href={`/admin/eintraege?mitglied=${encodeURIComponent(token)}`}>
          alle Einträge
        </Link>
      )}
    </span>
  )
}

/** Knöpfe am Konto der Person – Moderationskonten nur verwarnen (und das nur durch Admins). */
export function AccountButtons({ userId, role, isAdmin }: { userId: string | null; role: string | null; isAdmin: boolean }) {
  const a = m.admin.actions
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

export const confirms = (userId: string | null, what: string) => ({
  delete: { message: `${what} endgültig löschen? Das lässt sich nicht rückgängig machen.`, label: 'Löschen' },
  ...(userId ? { ban: { message: m.admin.account.banConfirm(memberRef(userId)), label: m.admin.actions.ban } } : {}),
})

export function Templates() {
  return (
    <datalist id="mod-templates">
      {m.admin.templates.map((t) => (
        <option key={t} value={t} />
      ))}
    </datalist>
  )
}

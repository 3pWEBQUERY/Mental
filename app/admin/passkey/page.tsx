import { redirect } from 'next/navigation'
import { logout } from '@/app/(auth)/actions'
import { hasStrongAuth, requireModeratorRole } from '@/lib/server/admin'
import { m } from '@/messages'

/** Ziel für Moderator:innen ohne Passkey-Sitzung – zeigt keine Daten. */
export default async function PasskeyRequiredPage() {
  const v = await requireModeratorRole('peer')
  if (hasStrongAuth(v)) redirect('/admin')
  return (
    <div className="auth-card stack">
      <h1>{m.admin.title}</h1>
      <p className="notice warn">{m.admin.passkeyRequired}</p>
      <form action={logout}>
        <button className="btn">{m.admin.passkeyRelogin}</button>
      </form>
    </div>
  )
}

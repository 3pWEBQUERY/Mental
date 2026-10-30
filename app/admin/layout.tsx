import Link from 'next/link'
import { connection } from 'next/server'
import type { ReactNode } from 'react'
import { logout } from '@/app/(auth)/actions'
import { Mark } from '@/components/ui'
import { AdminNav } from '@/components/admin/nav'
import { canModerate, hasStrongAuth, requireModerator } from '@/lib/server/admin'
import { m } from '@/messages'

export const instant = false

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await connection()
  const v = await requireModerator('peer')
  const strong = hasStrongAuth(v)
  return (
    <div className="public">
      <header className="public-top">
        <Link href="/lichtung" className="brand">
          <Mark />
          {m.admin.title}
        </Link>
        <nav aria-label={m.admin.title}>
          <Link className="btn ghost small" href="/lichtung">
            {m.nav.feed}
          </Link>
        </nav>
      </header>
      <main id="inhalt" className="public-main" style={{ maxWidth: 1100, width: '100%', margin: '0 auto' }}>
        {strong ? (
          <>
            <AdminNav admin={canModerate(v, 'admin')} />
            {children}
          </>
        ) : (
          <div className="auth-card stack">
            <h1>{m.admin.title}</h1>
            <p className="notice warn">{m.admin.passkeyRequired}</p>
            <form action={logout}>
              <button className="btn">{m.auth.passkey}</button>
            </form>
          </div>
        )}
      </main>
    </div>
  )
}

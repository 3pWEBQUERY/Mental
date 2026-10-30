import { and, count, eq, inArray, isNull } from 'drizzle-orm'
import Link from 'next/link'
import { connection } from 'next/server'
import type { ReactNode } from 'react'
import { db } from '@/db'
import { postMedia, posts } from '@/db/schema'
import { Mark } from '@/components/ui'
import { AdminNav } from '@/components/admin/nav'
import { canModerate, hasStrongAuth, requireModeratorRole } from '@/lib/server/admin'
import { m } from '@/messages'

export const instant = false

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await connection()
  const v = await requireModeratorRole('peer')
  const strong = hasStrongAuth(v)
  const level = canModerate(v, 'admin') ? 'admin' : canModerate(v, 'mod') ? 'mod' : 'peer'
  const [waiting] =
    strong && level !== 'peer'
      ? await db
          .select({ n: count() })
          .from(postMedia)
          .innerJoin(posts, eq(posts.id, postMedia.postId))
          .where(and(inArray(postMedia.status, ['quarantine', 'review']), isNull(posts.deletedAt)))
      : [{ n: 0 }]
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
        {strong && <AdminNav level={level} imagesWaiting={waiting?.n ?? 0} />}
        {children}
      </main>
    </div>
  )
}

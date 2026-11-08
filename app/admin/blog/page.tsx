import { desc } from 'drizzle-orm'
import Link from 'next/link'
import { db } from '@/db'
import { blogPosts } from '@/db/schema'
import { requireModerator } from '@/lib/server/admin'
import { formatDate } from '@/lib/time'

const CATS: Record<string, string> = {
  news: 'Neuigkeiten',
  knowledge: 'Wissen',
  stories: 'Erfahrungen',
}

/** Blog: alle Beiträge (Entwürfe und veröffentlichte), neueste zuerst. */
export default async function BlogAdmin() {
  await requireModerator('admin')
  const rows = await db
    .select({
      id: blogPosts.id,
      title: blogPosts.title,
      slug: blogPosts.slug,
      locale: blogPosts.locale,
      category: blogPosts.category,
      status: blogPosts.status,
      publishedAt: blogPosts.publishedAt,
      updatedAt: blogPosts.updatedAt,
    })
    .from(blogPosts)
    .orderBy(desc(blogPosts.updatedAt))
  return (
    <div className="stack">
      <div className="row-actions" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="page-title">Blog</h1>
        <Link className="btn" href="/admin/blog/neu">
          Neuer Beitrag
        </Link>
      </div>
      <p className="fine" style={{ maxWidth: 640 }}>
        Veröffentlichte Beiträge erscheinen sofort unter <a href="/blog">jiaia.app/blog</a> und die drei neuesten auf der Startseite – jeweils in ihrer Sprache.
        Entwürfe sieht nur das Admin-Team. Beiträge erscheinen «vom Team Jiaia», nie mit Namen.
      </p>
      {rows.length === 0 ? (
        <p className="notice">Noch keine Beiträge. Der Blog-Bereich auf der Startseite bleibt ausgeblendet, bis der erste veröffentlicht ist.</p>
      ) : (
        <div className="table-wrap">
          <table className="table blog-admin-table">
            <thead>
              <tr>
                <th>Titel</th>
                <th>Sprache</th>
                <th>Thema</th>
                <th>Status</th>
                <th>Geändert</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/admin/blog/${r.id}`}>{r.title}</Link>
                    <span className="fine" style={{ display: 'block' }}>
                      /blog/{r.slug}
                    </span>
                  </td>
                  <td>{r.locale.toUpperCase()}</td>
                  <td>{CATS[r.category] ?? r.category}</td>
                  <td>
                    <span className={`be-pill ${r.status}`}>{r.status === 'published' ? 'Veröffentlicht' : 'Entwurf'}</span>
                  </td>
                  <td>
                    {formatDate(r.updatedAt, {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

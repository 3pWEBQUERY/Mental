import type { Metadata } from 'next'
import Link from 'next/link'
import { connection } from 'next/server'
import { PostCard } from '@/components/blog/cards'
import { PublicShell } from '@/components/ui'
import { BLOG_CATEGORIES, isBlogCategory } from '@/lib/blog-text'
import { getPostsFor } from '@/lib/server/blog'
import { currentLocale, m } from '@/messages'
import { pageMeta } from '@/lib/seo'

// Pro Anfrage in der gewählten Sprache (Cookie); die Beiträge selbst kommen aus dem Cache (Tag «blog»).
export const instant = false

export async function generateMetadata(): Promise<Metadata> {
  return pageMeta({ title: m.blog.title, description: m.seo.blog, path: '/blog' })
}

/** Blog: der neueste Beitrag gross, die übrigen als Raster. Filter nach Thema über ?thema=. */
export default async function BlogPage({ searchParams }: { searchParams: Promise<{ thema?: string | string[] }> }) {
  await connection()
  const t = m.blog
  const locale = currentLocale()
  const raw = (await searchParams).thema
  const topic = isBlogCategory(Array.isArray(raw) ? raw[0] : raw) ? ((Array.isArray(raw) ? raw[0] : raw) as (typeof BLOG_CATEGORIES)[number]) : null
  const all = await getPostsFor(locale)
  const fallback = all.length > 0 && all[0]!.locale !== locale
  const present = new Set(all.map((p) => p.category))
  const posts = topic ? all.filter((p) => p.category === topic) : all
  const [first, ...rest] = posts
  return (
    <PublicShell>
      <div className="blog">
        <header className="blog-head">
          <p className="eyebrow">{t.title}</p>
          <h1 className="display">
            {t.titleLead} <em>{t.titleEm}</em>
          </h1>
          <p className="blog-intro">{t.intro}</p>
          {present.size > 1 && (
            <nav className="blog-topics" aria-label={t.filter}>
              <Link href="/blog" className="chip" aria-current={topic === null ? 'page' : undefined}>
                {t.all}
              </Link>
              {BLOG_CATEGORIES.filter((c) => present.has(c)).map((c) => (
                <Link key={c} href={`/blog?thema=${c}`} className="chip" aria-current={topic === c ? 'page' : undefined}>
                  {t.categories[c]}
                </Link>
              ))}
            </nav>
          )}
        </header>
        {fallback && <p className="notice blog-fallback">{t.fallback}</p>}
        {!first ? (
          <p className="notice">{all.length ? t.emptyCategory : t.empty}</p>
        ) : (
          <>
            <PostCard post={first} t={m} featured headingLevel={2} />
            {rest.length > 0 && (
              <div className="blog-grid">
                {rest.map((p) => (
                  <PostCard key={p.id} post={p} t={m} headingLevel={2} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </PublicShell>
  )
}

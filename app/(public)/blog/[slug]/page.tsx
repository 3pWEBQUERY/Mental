import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { CoverImage, PostCard, PostMeta } from '@/components/blog/cards'
import { RichText } from '@/components/blog/rich-text'
import { Mark, PublicShell } from '@/components/ui'
import { SLUG } from '@/lib/blog-text'
import { canModerate } from '@/lib/server/admin'
import { getMorePosts, getPost } from '@/lib/server/blog'
import { getViewer } from '@/lib/server/session'
import { currentLocale, getMessages, LOCALE_TAG, m } from '@/messages'
import { JsonLd } from '@/components/seo/json-ld'
import { NO_INDEX, pageMeta, SITE_URL } from '@/lib/seo'
import { articleData, breadcrumbs } from '@/lib/structured-data'

export const instant = false

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ vorschau?: string }>
}

/** Entwürfe sieht nur das Admin-Team – mit ?vorschau=1 aus dem Admin-Bereich. */
async function load({ params, searchParams }: Props) {
  const { slug } = await params
  if (!SLUG.test(slug)) return null
  const preview = (await searchParams).vorschau === '1'
  const v = preview ? await getViewer() : null
  return getPost(slug, Boolean(v && canModerate(v, 'admin')))
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const post = await load(props)
  if (!post) return { title: m.blog.title, robots: NO_INDEX }
  const meta = pageMeta({
    title: post.title,
    description: post.excerpt,
    path: `/blog/${post.slug}`,
    type: 'article',
    locale: post.locale,
    image: post.cover
      ? { url: `${post.cover.src}?w=1200`, width: 1200, height: Math.round((1200 * post.cover.height) / post.cover.width), alt: post.cover.alt }
      : undefined,
  })
  return {
    ...meta,
    openGraph: { ...meta.openGraph, type: 'article', publishedTime: post.publishedAt, modifiedTime: post.updatedAt },
    // Entwürfe nie in Suchmaschinen.
    robots: post.status === 'published' ? undefined : NO_INDEX,
  }
}

export default async function BlogPostPage(props: Props) {
  await connection()
  const post = await load(props)
  if (!post) notFound()
  // Der Beitrag in seiner Sprache; Rahmen und Hinweise in der Sprache der lesenden Person.
  const t = m.blog
  const own = getMessages(post.locale)
  const more = post.status === 'published' ? await getMorePosts(post) : []
  return (
    <PublicShell>
      {post.status === 'published' && (
        <>
          <JsonLd data={articleData({ ...post, locale: LOCALE_TAG[post.locale], image: post.cover ? `${SITE_URL}${post.cover.src}?w=1200` : undefined })} />
          <JsonLd data={breadcrumbs([{ name: m.brand, path: '/' }, { name: m.blog.title, path: '/blog' }, { name: post.title, path: `/blog/${post.slug}` }])} />
        </>
      )}
      <article className="blog-article" lang={LOCALE_TAG[post.locale]}>
        <Link href="/blog" className="blog-back">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
          {t.back}
        </Link>
        {post.status !== 'published' && <p className="notice warn">{t.draft}</p>}
        <header className="blog-article-head">
          <PostMeta post={post} t={own} />
          <h1 className="blog-article-title">{post.title}</h1>
          <p className="blog-article-lead">{post.excerpt}</p>
          <p className="blog-byline">
            <Mark className="blog-byline-mark" />
            {own.blog.byTeam}
          </p>
        </header>
        {post.cover && (
          <figure className="blog-article-cover">
            <CoverImage cover={post.cover} sizes="(min-width: 1100px) 1040px, 100vw" priority />
          </figure>
        )}
        <div className="blog-article-body">
          <RichText source={post.body} />
        </div>
        <aside className="blog-help" aria-labelledby="blog-help-title" lang={LOCALE_TAG[currentLocale()]}>
          <h2 id="blog-help-title">{t.helpTitle}</h2>
          <p>{t.helpText}</p>
          <Link className="btn small" href={m.help.href}>
            {t.helpLink}
          </Link>
        </aside>
      </article>
      {more.length > 0 && (
        <section className="blog blog-more" aria-labelledby="blog-more">
          <h2 id="blog-more" className="section-label">
            {t.moreTitle}
          </h2>
          <div className="blog-grid">
            {more.map((p) => (
              <PostCard key={p.id} post={p} t={own} />
            ))}
          </div>
        </section>
      )}
    </PublicShell>
  )
}

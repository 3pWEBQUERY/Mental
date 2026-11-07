import Link from 'next/link'
import type { BlogCard, BlogCover } from '@/lib/server/blog'
import { formatDate } from '@/lib/time'
import { LOCALE_TAG, type Messages } from '@/messages'

/** Titelbild in passenden Grössen (der Server rechnet 640/1200/2000 px, ein Jahr im Browser-Cache). */
export function CoverImage({ cover, sizes, priority = false, className }: { cover: BlogCover; sizes: string; priority?: boolean; className?: string }) {
  const widths = [640, 1200, 2000].filter((w) => w <= cover.width)
  const srcSet = [...(widths.length ? widths : [cover.width])].map((w) => `${cover.src}?w=${w} ${w}w`).join(', ')
  return (
    // Eigene Bild-Route (bereits WebP, ohne Metadaten) – next/image bräuchte hier nichts mehr zu tun.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={className}
      src={`${cover.src}?w=${widths.at(-1) ?? cover.width}`}
      srcSet={srcSet}
      sizes={sizes}
      alt={cover.alt}
      width={cover.width}
      height={cover.height}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      decoding="async"
    />
  )
}

export function PostMeta({ post, t }: { post: Pick<BlogCard, 'category' | 'publishedAt' | 'minutes'>; t: Messages }) {
  return (
    <p className="blog-meta">
      <span className="blog-cat">{t.blog.categories[post.category] ?? post.category}</span>
      <span aria-hidden="true">·</span>
      <time dateTime={post.publishedAt}>
        {formatDate(post.publishedAt, {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}
      </time>
      <span aria-hidden="true">·</span>
      <span>{t.blog.minutes(post.minutes)}</span>
    </p>
  )
}

/**
 * Beitrag als Karte. Der ganze Bereich ist klickbar (ein Link über dem Titel, per CSS über die Karte gezogen) –
 * Screenreader hören nur den Titel als Link, nicht die ganze Karte.
 */
export function PostCard({ post, t, featured = false, headingLevel = 3 }: { post: BlogCard; t: Messages; featured?: boolean; headingLevel?: 2 | 3 }) {
  const H = headingLevel === 2 ? 'h2' : 'h3'
  return (
    <article className={featured ? 'blog-card featured' : 'blog-card'} lang={LOCALE_TAG[post.locale]}>
      {post.cover && (
        <div className="blog-card-media">
          <CoverImage
            cover={{ ...post.cover, alt: '' }}
            sizes={featured ? '(min-width: 900px) 58vw, 100vw' : '(min-width: 900px) 30vw, (min-width: 600px) 46vw, 100vw'}
            priority={featured}
          />
        </div>
      )}
      <div className="blog-card-body">
        <PostMeta post={post} t={t} />
        <H className="blog-card-title">
          <Link href={`/blog/${post.slug}`}>{post.title}</Link>
        </H>
        <p className="blog-card-excerpt">{post.excerpt}</p>
        <span className="blog-card-read" aria-hidden="true">
          {t.blog.read}
          <svg viewBox="0 0 24 24">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </span>
      </div>
    </article>
  )
}

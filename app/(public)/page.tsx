import type { Viewport } from 'next'
import { connection } from 'next/server'
import { LandingHero } from '@/components/landing/hero'
import { PublicShell } from '@/components/ui'
import { PostCard } from '@/components/blog/cards'
import { getPostsFor } from '@/lib/server/blog'
import { getPartners } from '@/lib/server/partners'
import { currentLocale, m } from '@/messages'
import Link from 'next/link'

// Pro Anfrage in der gewählten Sprache (Cookie) – bewusst kein vorgerenderter Shell.
export const instant = false

/** Der Hero ist immer Nacht: Statusleiste und Browser-Leisten dunkel statt hell (wie der Himmel ganz oben). */
export const viewport: Viewport = { themeColor: '#050a16' }

/** Landing-Page in der gewählten Sprache (pro Anfrage). Eingeloggte leitet der Proxy direkt auf /start. */
export default async function Landing() {
  await connection()
  const l = m.landing
  const [partners, posts] = await Promise.all([getPartners(), getPostsFor(currentLocale())])
  const latest = posts.slice(0, 3)
  return (
    <PublicShell hero={<LandingHero />}>
      <div className="landing">
        <section aria-labelledby="prinzipien">
          <h2 id="prinzipien" className="section-label">
            {l.principlesTitle}
          </h2>
          <ul className="principles">
            {l.principles.map(([title, body]) => (
              <li key={title}>
                <b>{title}</b>
                <span>{body}</span>
              </li>
            ))}
          </ul>
        </section>
        {latest.length > 0 && (
          <section aria-labelledby="blog-start" className="blog-teaser">
            <div className="blog-teaser-head">
              <h2 id="blog-start" className="section-label">
                {m.blog.landingTitle}
              </h2>
              <Link href="/blog" className="blog-teaser-all">
                {m.blog.landingAll}
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </Link>
            </div>
            <div className="blog-grid">
              {latest.map((p) => (
                <PostCard key={p.id} post={p} t={m} />
              ))}
            </div>
          </section>
        )}
        {partners.length > 0 && (
          <section aria-labelledby="partner" className="partners">
            <h2 id="partner" className="section-label">
              {l.partners}
            </h2>
            <ul className="partner-list">
              {partners.map((p) => {
                const inner = p.logo ? (
                  // Logo ist schon klein gerechnet (WebP, max. 800×400) und lange cachebar – kein next/image nötig.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.logo.src} alt={p.name} width={p.logo.width} height={p.logo.height} loading="lazy" decoding="async" />
                ) : (
                  <span className="partner-name">{p.name}</span>
                )
                return (
                  <li key={p.id}>
                    {p.url ? (
                      <a className="partner-tile" href={p.url} target="_blank" rel="noopener noreferrer" aria-label={l.partnerLink(p.name)}>
                        {inner}
                      </a>
                    ) : (
                      <span className="partner-tile">{inner}</span>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        )}
      </div>
    </PublicShell>
  )
}

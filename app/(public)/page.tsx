import type { Metadata, Viewport } from 'next'
import { connection } from 'next/server'
import { LandingHero } from '@/components/landing/hero'
import { PublicShell } from '@/components/ui'
import { PostCard } from '@/components/blog/cards'
import { getPostsFor } from '@/lib/server/blog'
import { getPartners } from '@/lib/server/partners'
import { currentLocale, m } from '@/messages'
import Link from 'next/link'
import { JsonLd } from '@/components/seo/json-ld'
import { pageMeta } from '@/lib/seo'
import { siteGraph } from '@/lib/structured-data'

// Pro Anfrage in der gewählten Sprache (Cookie) – bewusst kein vorgerenderter Shell.
export const instant = false

/** Der Hero ist immer Nacht: Statusleiste und Browser-Leisten dunkel statt hell (wie der Himmel ganz oben). */
export const viewport: Viewport = { themeColor: '#050a16' }

export async function generateMetadata(): Promise<Metadata> {
  return pageMeta({ absoluteTitle: m.seo.title, description: m.seo.home, path: '/' })
}

/** Landing-Page in der gewählten Sprache (pro Anfrage). Eingeloggte leitet der Proxy direkt auf /start. */
export default async function Landing() {
  await connection()
  const l = m.landing
  const [partners, posts] = await Promise.all([getPartners(), getPostsFor(currentLocale())])
  const latest = posts.slice(0, 3)
  return (
    <PublicShell hero={<LandingHero />}>
      <JsonLd data={siteGraph(m.seo.home)} />
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
          <section aria-labelledby="anlaufstellen" className="partners">
            <h2 id="anlaufstellen" className="section-label">
              {l.partners}
            </h2>
            <p className="partners-lead">{l.partnersLead}</p>
            <ul className="partner-list">
              {partners.map((p) => {
                const logo = p.logo ? (
                  // Logo ist schon klein gerechnet (WebP, max. 800×400) und lange cachebar – kein next/image nötig.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.logo.src} alt={p.name} width={p.logo.width} height={p.logo.height} loading="lazy" decoding="async" />
                ) : (
                  <span className="partner-name">{p.name}</span>
                )
                const host = hostOf(p.url)
                return (
                  <li key={p.id}>
                    {p.url ? (
                      <a className="partner" href={p.url} target="_blank" rel="noopener noreferrer" aria-label={l.partnerLink(p.name)}>
                        <span className="partner-logo">{logo}</span>
                        {host && (
                          <span className="partner-host">
                            {host}
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M7 17 17 7M9 7h8v8" />
                            </svg>
                          </span>
                        )}
                      </a>
                    ) : (
                      <span className="partner">
                        <span className="partner-logo">{logo}</span>
                      </span>
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

/** «https://www.143.ch/hilfe» → «143.ch»: zeigt, wohin der Link führt. */
function hostOf(url: string | null) {
  if (!url) return null
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

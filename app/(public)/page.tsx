import type { Viewport } from 'next'
import { connection } from 'next/server'
import { LandingHero } from '@/components/landing/hero'
import { PublicShell } from '@/components/ui'
import { getPartners } from '@/lib/server/partners'
import { m } from '@/messages'

// Pro Anfrage in der gewählten Sprache (Cookie) – bewusst kein vorgerenderter Shell.
export const instant = false

/** Der Hero ist immer Nacht: Statusleiste und Browser-Leisten dunkel statt hell (wie der Himmel ganz oben). */
export const viewport: Viewport = { themeColor: '#050a16' }

/** Landing-Page in der gewählten Sprache (pro Anfrage). Eingeloggte leitet der Proxy direkt auf /start. */
export default async function Landing() {
  await connection()
  const l = m.landing
  const partners = await getPartners()
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

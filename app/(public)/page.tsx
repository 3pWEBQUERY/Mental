import type { Viewport } from 'next'
import { connection } from 'next/server'
import { LandingHero } from '@/components/landing/hero'
import { PublicShell } from '@/components/ui'
import { m } from '@/messages'

// Pro Anfrage in der gewählten Sprache (Cookie) – bewusst kein vorgerenderter Shell.
export const instant = false

/** Der Hero ist immer Nacht: Statusleiste und Browser-Leisten dunkel statt hell (wie der Himmel ganz oben). */
export const viewport: Viewport = { themeColor: '#050a16' }

/** Landing-Page in der gewählten Sprache (pro Anfrage). Eingeloggte leitet der Proxy direkt auf /start. */
export default async function Landing() {
  await connection()
  const l = m.landing
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
      </div>
    </PublicShell>
  )
}

import Link from 'next/link'
import { connection } from 'next/server'
import { HeroArt } from '@/components/landing/hero-art'
import { PublicShell } from '@/components/ui'
import { m } from '@/messages'

// Pro Anfrage in der gewählten Sprache (Cookie) – bewusst kein vorgerenderter Shell.
export const instant = false

/** Landing-Page in der gewählten Sprache (pro Anfrage). Eingeloggte leitet der Proxy direkt auf /start. */
export default async function Landing() {
  await connection()
  const l = m.landing
  return (
    <PublicShell>
      <div className="landing">
        <section className="landing-hero">
          <div>
            <div className="eyebrow">{l.eyebrow}</div>
            <h1 className="display">
              {l.title} <em>{l.titleEm}</em> {l.titleEnd}
            </h1>
            <p className="lead">{l.lead}</p>
            <div className="row-actions">
              <Link className="btn" href="/registrieren">
                {l.cta}
              </Link>
              <Link className="btn ghost" href="/anmelden">
                {l.login}
              </Link>
            </div>
          </div>
          <HeroArt />
        </section>

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

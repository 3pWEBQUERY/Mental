import Link from 'next/link'
import { PublicShell } from '@/components/ui'
import { m } from '@/messages'

/** Statische Landing-Page. Eingeloggte werden vom Proxy direkt in die Lichtung geleitet. */
export default function Landing() {
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
          <div className="landing-orb" aria-hidden="true">
            <svg viewBox="0 0 400 400">
              <circle cx="200" cy="200" r="118" strokeWidth="1" />
              <circle cx="200" cy="200" r="86" strokeWidth="1" strokeDasharray="1 7" strokeLinecap="round" />
              <circle cx="200" cy="200" r="52" strokeWidth="1" strokeDasharray="1 6" strokeLinecap="round" />
              <ellipse cx="200" cy="200" rx="176" ry="54" strokeWidth="1" opacity=".35" transform="rotate(-18 200 200)" />
              <ellipse cx="200" cy="200" rx="190" ry="70" strokeWidth="1" opacity=".25" transform="rotate(24 200 200)" />
              <circle cx="40" cy="250" r="5" style={{ fill: 'var(--clay)', stroke: 'none' }} />
              <circle cx="352" cy="150" r="5" style={{ fill: 'var(--clay)', stroke: 'none' }} />
              <circle cx="300" cy="300" r="4" style={{ fill: 'var(--clay)', stroke: 'none' }} />
              <circle cx="200" cy="200" r="22" style={{ fill: 'var(--clay)', stroke: 'none' }} />
            </svg>
          </div>
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

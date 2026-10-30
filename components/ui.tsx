import Link from 'next/link'
import type { ReactNode } from 'react'
import { glyphPath } from '@/lib/glyph'
import type { HelpResource } from '@/lib/help'
import { m } from '@/messages'
import { ThemeToggle } from './theme-toggle'

export function Mark({ className = 'mark' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 34 34" aria-hidden="true">
      <circle cx="17" cy="17" r="15.5" fill="none" strokeWidth="1.4" />
      <circle cx="17" cy="17" r="6" />
    </svg>
  )
}

export function Glyph({ seed, mood, small }: { seed: number; mood: number; small?: boolean }) {
  return (
    <svg className={small ? 'glyph small' : 'glyph'} viewBox="0 0 40 40" aria-hidden="true">
      <path d={glyphPath(seed, mood)} fill={`var(--mood-${Math.min(4, Math.max(0, mood))})`} />
    </svg>
  )
}

export function HelpList({ resources, intro = true, eyebrow = true }: { resources: HelpResource[]; intro?: boolean; eyebrow?: boolean }) {
  return (
    <>
      {eyebrow && <h3>{m.help.eyebrow}</h3>}
      {intro && <p>{m.help.intro}</p>}
      {resources.map((h) =>
        h.phone ? (
          <a key={h.name} className="line" href={`tel:${h.phone.replace(/\s/g, '')}`}>
            <span>
              {h.name}
              <br />
              <span className="fine">
                {h.audience} · {h.hours}
              </span>
            </span>
            <b>{h.phone}</b>
          </a>
        ) : h.url ? (
          <a key={h.name} className="line chat" href={h.url} target="_blank" rel="noopener noreferrer">
            <span>
              {h.name}
              <br />
              <span className="fine">
                {h.audience} · {h.hours}
              </span>
            </span>
            <b>{m.help.chat}</b>
          </a>
        ) : null,
      )}
    </>
  )
}

export function PublicShell({ children, active }: { children: ReactNode; active?: 'login' | 'register' | 'help' }) {
  return (
    <div className="public">
      <a className="skip" href="#inhalt">
        Zum Inhalt
      </a>
      <header className="public-top">
        <Link href="/" className="brand">
          <Mark />
          {m.brand}
        </Link>
        <nav aria-label={m.nav.label}>
          {active !== 'login' && (
            <Link className="btn ghost small hide-sm" href="/anmelden">
              {m.auth.login}
            </Link>
          )}
          <Link className="help-pill" href="/hilfe" aria-current={active === 'help' ? 'page' : undefined}>
            {m.nav.help}
          </Link>
          <ThemeToggle />
        </nav>
      </header>
      <main id="inhalt" className="public-main">
        {children}
      </main>
      <footer className="public-foot">
        <span>{m.common.fine}</span>
        <Link href="/regeln">{m.landing.rules}</Link>
        <Link href="/datenschutz">{m.landing.privacy}</Link>
        <Link href="/impressum">{m.landing.imprint}</Link>
        <Link href="/hilfe">{m.landing.help}</Link>
      </footer>
    </div>
  )
}

/** Ruhiger Platzhalter, solange eine Seite lädt – statt eines leeren Bildschirms. */
export function Loading() {
  return (
    <p className="loading" role="status">
      {m.common.loading}
    </p>
  )
}

/** Für viele ist der erste Satz die grösste Hürde – darum ein paar fertige Anfänge. Ohne JavaScript (details). */
export function PhoneScript({ open = false }: { open?: boolean }) {
  const p = m.help.phone
  return (
    <details className="phone-script" open={open}>
      <summary>{p.title}</summary>
      <p>{p.lead}</p>
      <ul>
        {p.lines.map((l) => (
          <li key={l}>«{l}»</li>
        ))}
      </ul>
      <p className="fine">{p.after}</p>
    </details>
  )
}

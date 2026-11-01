import Link from 'next/link'
import type { ReactNode } from 'react'
import { glyphPath } from '@/lib/glyph'
import type { HelpResource } from '@/lib/help'
import { m, type Messages } from '@/messages'
import { ThemeToggle } from './theme-toggle'
import { LangSwitch } from './lang-switch'

/**
 * Logo: die Flamme mit dem Funken (public/jiaia-logo.svg – Original in docs/brand). Als Bild statt inline, damit
 * es einmal geladen und gecacht wird. alt="" – daneben steht der Name bzw. der Link hat sein eigenes aria-label.
 */
export function Mark({ className = 'mark' }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- statisches SVG, keine Bildoptimierung nötig
  return <img src="/jiaia-logo.svg" alt="" className={className} width={374} height={614} decoding="async" />
}

export function Glyph({ seed, mood, small }: { seed: number; mood: number; small?: boolean }) {
  return (
    <svg className={small ? 'glyph small' : 'glyph'} viewBox="0 0 40 40" aria-hidden="true">
      <path d={glyphPath(seed, mood)} fill={`var(--mood-${Math.min(4, Math.max(0, mood))})`} />
    </svg>
  )
}

export function HelpList({
  resources,
  intro = true,
  eyebrow = true,
  t = m,
}: {
  resources: HelpResource[]
  intro?: boolean
  eyebrow?: boolean
  /** Wörterbuch – Standard Deutsch, /aide gibt das französische mit. */
  t?: Messages
}) {
  return (
    <>
      {eyebrow && <h3>{t.help.eyebrow}</h3>}
      {intro && <p>{t.help.intro}</p>}
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
            <b>{t.help.chat}</b>
          </a>
        ) : null,
      )}
    </>
  )
}

export function PublicShell({
  children,
  active,
  t = m,
  lang,
}: {
  children: ReactNode
  active?: 'login' | 'register' | 'help'
  /** Wörterbuch und Sprache der Seite – Standard Deutsch (das <html>-Element bleibt de-CH). */
  t?: Messages
  lang?: string
}) {
  const helpHref = t.help.href
  const current = helpHref === '/aide' ? 'fr' : helpHref === '/aiuto' ? 'it' : 'de'
  return (
    <div className="public" lang={lang}>
      <a className="skip" href="#inhalt">
        {t.nav.skip}
      </a>
      <header className="public-top">
        <Link href="/" className="brand">
          <Mark />
          <span className="wordmark">{t.brand}</span>
        </Link>
        <nav aria-label={t.nav.label}>
          {active !== 'login' && (
            <Link className="btn ghost small hide-sm" href="/anmelden">
              {t.auth.login}
            </Link>
          )}
          <Link className="help-pill" href={helpHref} aria-current={active === 'help' ? 'page' : undefined}>
            {t.nav.help}
          </Link>
          <LangSwitch current={current} label={t.settings.language} fallback={active === 'help' ? helpHref : '/'} />
          <ThemeToggle labels={{ toLight: t.settings.toLight, toDark: t.settings.toDark, toggle: t.settings.toggleTheme }} />
        </nav>
      </header>
      <main id="inhalt" className="public-main">
        {children}
      </main>
      <footer className="public-foot">
        <span>{t.common.fine}</span>
        <Link href="/regeln">{t.landing.rules}</Link>
        <Link href="/datenschutz">{t.landing.privacy}</Link>
        <Link href="/transparenz">{t.landing.transparency}</Link>
        <Link href="/impressum">{t.landing.imprint}</Link>
        <Link href={helpHref}>{t.landing.help}</Link>
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
export function PhoneScript({ open = false, t = m }: { open?: boolean; t?: Messages }) {
  const p = t.help.phone
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

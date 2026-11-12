import Link from 'next/link'
import type { ReactNode } from 'react'
import { glyphPath } from '@/lib/glyph'
import type { HelpResource } from '@/lib/help'
import { SOCIAL } from '@/lib/social'
import { APP_STORE_URL } from '@/lib/app-store'
import { getImageProps } from 'next/image'
import skyImage from '@/components/landing/hero-poster.webp'
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
  hero,
}: {
  children: ReactNode
  active?: 'login' | 'register' | 'help'
  /** Bildfüllender Bereich ganz oben (Startseite): Der Header liegt dann ohne Hintergrund darauf. */
  hero?: ReactNode
  /** Wörterbuch und Sprache der Seite – Standard Deutsch (das <html>-Element bleibt de-CH). */
  t?: Messages
  lang?: string
}) {
  const helpHref = t.help.href
  const current = helpHref === '/aide' ? 'fr' : helpHref === '/aiuto' ? 'it' : helpHref === '/help' ? 'en' : 'de'
  const header = (
    <header className={hero ? 'public-top on-hero' : 'public-top'}>
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
  )
  return (
    <div className={hero ? 'public with-hero' : 'public'} lang={lang}>
      <a className="skip" href="#inhalt">
        {t.nav.skip}
      </a>
      {header}
      {/* Der Hero gehört zum Inhalt: «Zum Inhalt» führt so direkt zur Frage und zum Anmelden. */}
      <main id="inhalt" className="public-main">
        {hero}
        {children}
      </main>
      {/* Nicht auf den Hilfeseiten (nichts soll von den Nummern ablenken) und nicht beim Anmelden und Registrieren. */}
      {!active && <AppStore t={t} />}
      <footer className="public-foot">
        <span>{t.common.fine}</span>
        <Link href="/blog">{t.landing.blog}</Link>
        <Link href="/regeln">{t.landing.rules}</Link>
        <Link href="/datenschutz">{t.landing.privacy}</Link>
        <Link href="/transparenz">{t.landing.transparency}</Link>
        <Link href="/impressum">{t.landing.imprint}</Link>
        <Link href={helpHref}>{t.landing.help}</Link>
        <SocialLinks label={t.landing.social} linkLabel={t.landing.socialLink} />
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

/** Apple-Logo (Simple Icons, CC0) für den App-Store-Knopf. */
const APPLE_PATH =
  'M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701'

/**
 * Bereich über dem Footer: Jiaia im App Store. Eine Nachtkarte mit einem Ausschnitt des Sternenhimmels der Startseite,
 * dem App-Icon, dem Abzeichen und – am Computer – einem QR-Code für die iPhone-Kamera.
 */
function AppStore({ t }: { t: Messages }) {
  const l = t.landing
  const { props: sky } = getImageProps({ src: skyImage, alt: '', width: 1600, height: 900, quality: 70 })
  return (
    <section className="app-store" aria-label={l.appTitle}>
      <div className="app-store-card" style={{ ['--sky' as string]: `url(${sky.src})` }}>
        <div className="app-store-copy">
          <p className="app-store-eyebrow">{l.appEyebrow}</p>
          <h2 className="app-store-title">
            {l.appTitleLead} <em>{l.appTitleEm}</em>
          </h2>
          <p className="app-store-text">{l.appText}</p>
          <div className="app-store-cta">
            <a className="app-store-badge" href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" aria-label={l.appLink}>
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d={APPLE_PATH} />
              </svg>
              <span aria-hidden="true">
                <small>{l.appBadgeSmall}</small>
                <b>{l.appBadgeBig}</b>
              </span>
            </a>
            <figure className="app-store-qr">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/app-store-qr.svg" alt="" width={33} height={33} />
              <figcaption>{l.appScan}</figcaption>
            </figure>
          </div>
        </div>
        <div className="app-store-icon" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-512.png" alt="" width={512} height={512} loading="lazy" decoding="async" />
          <span className="app-store-name">Jiaia</span>
        </div>
      </div>
    </section>
  )
}

/** Runde Knöpfe zu Jiaia in den sozialen Medien (lib/social.ts) – nur Konten mit Adresse. */
function SocialLinks({ label, linkLabel }: { label: string; linkLabel: (name: string) => string }) {
  const list = SOCIAL.filter((s) => s.url)
  if (!list.length) return null
  return (
    <nav className="social" aria-label={label}>
      {list.map((s) => (
        <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer me" aria-label={linkLabel(s.name)} title={s.name}>
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d={s.path} />
          </svg>
        </a>
      ))}
    </nav>
  )
}

import Link from 'next/link'
import type { ReactNode } from 'react'
import { glyphPath } from '@/lib/glyph'
import type { HelpResource } from '@/lib/help'
import { SOCIAL } from '@/lib/social'
import { APP_STORE_URL, APPLE_PATH } from '@/lib/app-store'
import { AppSheet } from './app-sheet'
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
  active?: 'login' | 'register' | 'recover' | 'help'
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
      {/* Nicht auf den Hilfeseiten (nichts soll von den Nummern ablenken) und nicht beim Anmelden, Registrieren und Wiederherstellen. */}
      {!active && <AppStore t={t} />}
      {/* Am iPhone/iPad einmal ein Blatt mit der App – auf denselben Seiten wie der App-Bereich. */}
      {!active && <AppSheet href={APP_STORE_URL} sky={sheetSky()} t={sheetText(t)} />}
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


/**
 * Bereich über dem Footer: Jiaia im App Store. Eine Nachtkarte mit einem Ausschnitt des Sternenhimmels der Startseite,
 * dem App-Icon, dem Abzeichen und – am Computer – einem QR-Code für die iPhone-Kamera.
 */
/** Himmelsausschnitt fürs Blatt: klein gerechnet, es ist nur ein schmaler Streifen. */
const sheetSky = () => getImageProps({ src: skyImage, alt: '', width: 900, height: 506, quality: 65 }).props.src

const sheetText = (t: Messages) => ({
  label: t.landing.appTitle,
  eyebrow: t.landing.appEyebrow,
  titleLead: t.landing.appTitleLead,
  titleEm: t.landing.appTitleEm,
  text: t.landing.appText,
  cta: t.landing.sheetCta,
  ctaLabel: t.landing.appLink,
  later: t.landing.sheetLater,
})

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

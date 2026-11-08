import { getImageProps } from 'next/image'
import Link from 'next/link'
import { m } from '@/messages'
import { HeroVideo } from './hero-video'
import posterDesktop from './hero-poster.webp'
import posterMobile from './hero-poster-m.webp'

const Icon = {
  arrow: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h13M13 6l6 6-6 6" />
    </svg>
  ),
  help: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6.6 3.5h3l1.5 4-2 1.3a11 11 0 0 0 6.1 6.1l1.3-2 4 1.5v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2Z" />
    </svg>
  ),
  rules: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 4.5h9.5L19 9v10.5H5zM14.5 4.5V9H19M8.5 13h7M8.5 16.5h5" />
    </svg>
  ),
  open: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 19.5h16M7 16.5v-5M12 16.5V7M17 16.5v-8" />
    </svg>
  ),
}

/**
 * Standbild = erstes Bild der Video-Schleife. Hochformat (bis 9:16) bekommt einen Ausschnitt aus der Bildmitte –
 * sonst würde auf dem Handy ein Viertel eines Querformat-Bilds hochskaliert (unscharf). Dieselbe Grenze wählt
 * das Video (hero-video.tsx), damit beim Übergang nichts springt. Es zählt für die Ladezeit: früh und mit Vorrang.
 */
function Poster() {
  const common = { alt: '', sizes: '100vw', fill: true, loading: 'eager', fetchPriority: 'high', placeholder: 'blur' } as const
  const { props: desktop } = getImageProps({ ...common, src: posterDesktop })
  const {
    props: { srcSet: mobile },
  } = getImageProps({ ...common, src: posterMobile })
  return (
    <picture>
      <source media="(max-aspect-ratio: 9/16)" srcSet={mobile} sizes="100vw" />
      {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- getImageProps liefert alt="" */}
      <img {...desktop} className="hero-bg" />
    </picture>
  )
}

/**
 * Startseite: Sternenhimmel über die ganze Breite, der Header liegt ohne Hintergrund darauf (PublicShell `hero`).
 * Der Text steht oben im dunklen Himmel; das Licht aus dem Kopf der Person läuft genau darauf zu.
 * Statt eines E-Mail-Felds (Jiaia fragt nie nach einer E-Mail) die Frage aus dem Gedanken-Fenster – sie führt
 * zur Registrierung. Das Bild ist Stimmung, keine Information: alt="".
 */
export function LandingHero() {
  const l = m.landing
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-bg-wrap">
        <Poster />
        <HeroVideo />
      </div>
      <div className="hero-inner">
        <p className="hero-eyebrow">{l.eyebrow}</p>
        <h1 id="hero-title" className="hero-title">
          {l.title} <em>{l.titleEm}</em> {l.titleEnd}
        </h1>
        <Link href="/registrieren" className="hero-ask">
          <span className="hero-ask-text">{l.ask}</span>
          <span className="sr-only"> – {l.cta}</span>
          <span className="hero-ask-go">{Icon.arrow}</span>
        </Link>
        <p className="hero-lead">{l.lead}</p>
        <Link href="/anmelden" className="hero-login">
          {l.login}
        </Link>
      </div>
      <nav className="hero-quick" aria-label={l.quick}>
        <Link href={m.help.href} aria-label={l.help} title={l.help}>
          {Icon.help}
        </Link>
        <Link href="/regeln" aria-label={l.rules} title={l.rules}>
          {Icon.rules}
        </Link>
        <Link href="/transparenz" aria-label={l.transparency} title={l.transparency}>
          {Icon.open}
        </Link>
      </nav>
    </section>
  )
}

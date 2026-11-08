import type { Metadata } from 'next'
import { LOCALE_TAG, m, currentLocale } from '@/messages'

/** Öffentliche Adresse (für Canonical, Sitemap, Open Graph). Ohne https-APP_URL (lokal, Tests): jiaia.app. */
export const SITE_URL = (process.env.APP_URL?.startsWith('https://') ? process.env.APP_URL : 'https://jiaia.app').replace(/\/$/, '')

export const OG_IMAGE = { url: '/og.jpg', width: 1200, height: 630 }

/** Open-Graph-Locale: de_CH, fr_CH, it_CH, en_CH. */
export const ogLocale = () => LOCALE_TAG[currentLocale()].replace('-', '_')

/**
 * Metadaten einer öffentlichen Seite: Titel, Beschreibung, Canonical und die Vorschau beim Teilen (Open Graph,
 * X/Twitter). Ohne eigenes Bild das Jiaia-Bild (public/og.jpg).
 */
export function pageMeta({
  title,
  absoluteTitle,
  description,
  path,
  image,
  type = 'website',
  locale,
}: {
  title?: string
  absoluteTitle?: string
  description: string
  path: string
  image?: { url: string; width?: number; height?: number; alt?: string }
  type?: 'website' | 'article'
  /** Feste Sprache der Seite (z. B. /aide), sonst die gewählte. */
  locale?: 'de' | 'fr' | 'it' | 'en'
}): Metadata {
  const shareTitle = absoluteTitle ?? (title ? `${title} · ${m.brand}` : m.seo.title)
  const img = image ?? { ...OG_IMAGE, alt: m.seo.ogAlt }
  return {
    title: absoluteTitle ? { absolute: absoluteTitle } : title,
    description,
    alternates: { canonical: path },
    openGraph: { type, url: path, siteName: m.brand, locale: locale ? LOCALE_TAG[locale].replace('-', '_') : ogLocale(), title: shareTitle, description, images: [img] },
    twitter: { card: 'summary_large_image', title: shareTitle, description, images: [img.url] },
  }
}

/** Interne Seiten (Raum, Einstellungen, Admin, Anmeldung): nie in Suchmaschinen. */
export const NO_INDEX: Metadata['robots'] = { index: false, follow: false, nocache: true }

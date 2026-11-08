import type { MetadataRoute } from 'next'
import { getMessages, LOCALE_TAG, type Locale } from '@/messages'

const HELP_PATH: Record<Locale, string> = { de: '/hilfe', fr: '/aide', it: '/aiuto', en: '/help' }

/** Web-App-Manifest in einer Sprache – Name, Beschreibung und Kurzbefehle der installierten App. */
export function manifestFor(locale: Locale): MetadataRoute.Manifest {
  const t = getMessages(locale)
  return {
    name: t.brand,
    short_name: t.brand,
    description: t.meta.description,
    lang: LOCALE_TAG[locale],
    start_url: '/start',
    scope: '/',
    display: 'standalone',
    background_color: '#EFECE4',
    theme_color: '#EFECE4',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: t.nav.share, url: '/start?teilen=1' },
      { name: t.nav.breathe, url: '/start?atmen=1' },
      { name: t.nav.help, url: HELP_PATH[locale] },
    ],
  }
}

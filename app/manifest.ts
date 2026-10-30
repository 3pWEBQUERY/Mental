import type { MetadataRoute } from 'next'
import { m } from '@/messages'

/** Lichtung ist als PWA installierbar – keine nativen Apps in Version 1. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: m.brand,
    short_name: m.brand,
    description: m.meta.description,
    lang: 'de-CH',
    start_url: '/lichtung',
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
      { name: m.nav.share, url: '/lichtung?teilen=1' },
      { name: m.nav.breathe, url: '/lichtung?atmen=1' },
      { name: m.nav.help, url: '/hilfe' },
    ],
  }
}

import type { MetadataRoute } from 'next'
import { manifestFor } from '@/lib/manifest'

/**
 * Jiaia ist als PWA installierbar – keine nativen Apps in Version 1. Vorgerendert auf Deutsch; Französisch und
 * Italienisch liefert /api/manifest/<lang>, auf das components/html-lang.tsx den Verweis im Browser umstellt.
 * (Den Cookie liest das Manifest nicht: Browser holen es ohne Cookies.)
 */
export default function manifest(): MetadataRoute.Manifest {
  return manifestFor('de')
}

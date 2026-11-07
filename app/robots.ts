import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo'

/** Öffentliches für alle Suchmaschinen; Persönliches (Raum, Einstellungen, Admin) und Schnittstellen nie. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/api/blog-image/', '/api/partner-logo/'],
        disallow: ['/start', '/ich', '/einstellungen', '/admin', '/api/', '/sprache', '/wiederherstellen', '/anmelden', '/offline'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}

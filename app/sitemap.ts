import type { MetadataRoute } from 'next'
import { connection } from 'next/server'
import { getPublishedPosts } from '@/lib/server/blog'
import { SITE_URL } from '@/lib/seo'

const HELP = { 'de-CH': `${SITE_URL}/hilfe`, 'fr-CH': `${SITE_URL}/aide`, 'it-CH': `${SITE_URL}/aiuto`, 'en-CH': `${SITE_URL}/help` }

/**
 * Sitemap: die öffentlichen Seiten, die vier Hilfeseiten (als Sprachfassungen voneinander) und alle veröffentlichten
 * Blogbeiträge. Bei jeder Anfrage aktuell (ein neuer Beitrag steht sofort drin).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection()
  const posts = await getPublishedPosts()
  const latest = posts[0]?.publishedAt ? new Date(posts[0].publishedAt) : undefined
  const page = (path: string, priority: number, changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'], lastModified?: Date) => ({
    url: `${SITE_URL}${path}`,
    priority,
    changeFrequency,
    ...(lastModified ? { lastModified } : {}),
  })
  return [
    page('/', 1, 'weekly', latest),
    page('/blog', 0.8, 'weekly', latest),
    ...Object.values(HELP).map((url) => ({ url, priority: 0.9, changeFrequency: 'monthly' as const, alternates: { languages: HELP } })),
    page('/registrieren', 0.6, 'yearly'),
    page('/regeln', 0.5, 'monthly'),
    page('/transparenz', 0.4, 'monthly'),
    page('/datenschutz', 0.3, 'yearly'),
    page('/impressum', 0.2, 'yearly'),
    ...posts.map((p) => page(`/blog/${p.slug}`, 0.7, 'monthly', new Date(p.publishedAt))),
  ]
}

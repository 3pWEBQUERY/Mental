import { APP_STORE_URL } from '@/lib/app-store'
import { SITE_URL } from '@/lib/seo'
import { SOCIAL } from '@/lib/social'

const ORG_ID = `${SITE_URL}/#organisation`
const SITE_ID = `${SITE_URL}/#website`

/** Jiaia als Organisation, Website und App – auf der Startseite. */
export function siteGraph(description: string) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': ORG_ID,
        name: 'Jiaia',
        url: SITE_URL,
        logo: { '@type': 'ImageObject', url: `${SITE_URL}/icons/icon-512.png`, width: 512, height: 512 },
        email: 'kontakt@jiaia.app',
        areaServed: { '@type': 'Country', name: 'Schweiz' },
        sameAs: [...SOCIAL.filter((s) => s.url).map((s) => s.url!), APP_STORE_URL],
      },
      {
        '@type': 'WebSite',
        '@id': SITE_ID,
        url: SITE_URL,
        name: 'Jiaia',
        description,
        inLanguage: ['de-CH', 'fr-CH', 'it-CH', 'en-CH'],
        publisher: { '@id': ORG_ID },
      },
      {
        '@type': 'MobileApplication',
        name: 'Jiaia',
        operatingSystem: 'iOS',
        applicationCategory: 'HealthApplication',
        url: APP_STORE_URL,
        installUrl: APP_STORE_URL,
        publisher: { '@id': ORG_ID },
      },
    ],
  }
}

/** Ein Blogbeitrag als BlogPosting. */
export function articleData(a: { slug: string; title: string; excerpt: string; publishedAt: string; updatedAt: string; locale: string; image?: string }) {
  const url = `${SITE_URL}/blog/${a.slug}`
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': `${url}#beitrag`,
    mainEntityOfPage: url,
    url,
    headline: a.title,
    description: a.excerpt,
    image: a.image ? [a.image] : [`${SITE_URL}/og.jpg`],
    datePublished: a.publishedAt,
    dateModified: a.updatedAt,
    inLanguage: a.locale,
    author: { '@type': 'Organization', '@id': ORG_ID, name: 'Jiaia', url: SITE_URL },
    publisher: { '@type': 'Organization', '@id': ORG_ID, name: 'Jiaia', logo: { '@type': 'ImageObject', url: `${SITE_URL}/icons/icon-512.png` } },
  }
}

/** Brotkrumen: Startseite › Blog › Beitrag. */
export function breadcrumbs(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: `${SITE_URL}${it.path}` })),
  }
}

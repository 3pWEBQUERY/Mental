import { expect, test } from '@playwright/test'

/** Auffindbarkeit: robots.txt, Sitemap, Metadaten, strukturierte Daten und der erste Blogbeitrag (Seed). */
test('SEO: robots.txt und Sitemap – Öffentliches drin, Persönliches draussen', async ({ request }) => {
  const robots = await (await request.get('/robots.txt')).text()
  expect(robots).toContain('Sitemap: ')
  for (const path of ['/start', '/ich', '/einstellungen', '/admin', '/api/']) expect(robots).toContain(`Disallow: ${path}`)
  expect(robots).toContain('Allow: /api/blog-image/')

  const sitemap = await (await request.get('/sitemap.xml')).text()
  for (const path of ['/blog', '/hilfe', '/aide', '/aiuto', '/help', '/registrieren', '/blog/jiaia-ist-da']) expect(sitemap).toContain(`${path}</loc>`)
  expect(sitemap).toContain('hreflang="fr-CH"')
  expect(sitemap).not.toContain('/start</loc>')
})

test('SEO: Startseite mit Titel, Beschreibung, Canonical, Vorschaubild und strukturierten Daten', async ({ page, request }) => {
  await page.goto('/')
  await expect(page).toHaveTitle('Jiaia – anonym Gedanken teilen, Zuspruch bekommen')
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /anonymer Ort in der Schweiz/)
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/$|jiaia\.app$/)
  const og = await page.locator('meta[property="og:image"]').getAttribute('content')
  expect(og).toMatch(/\/og\.jpg$/)
  expect((await request.get('/og.jpg')).headers()['content-type']).toContain('image/jpeg')
  await expect(page.locator('meta[name="apple-itunes-app"]')).toHaveAttribute('content', 'app-id=6829498048')
  const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').first().textContent())!)
  expect(ld['@graph'].map((n: { '@type': string }) => n['@type'])).toEqual(['Organization', 'WebSite', 'MobileApplication'])
})

test('SEO: erster Blogbeitrag in vier Sprachen, als Artikel ausgezeichnet; interne Seiten noindex', async ({ page }) => {
  for (const [slug, title] of [
    ['jiaia-ist-da', 'Jiaia ist da – im Web und als App'],
    ['jiaia-est-la', 'Jiaia est là – sur le web et en application'],
    ['jiaia-e-qui', 'Jiaia è qui – sul web e come app'],
    ['jiaia-is-here', 'Jiaia is here – on the web and as an app'],
  ] as const) {
    await page.goto(`/blog/${slug}`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title)
  }
  await page.goto('/blog/jiaia-ist-da')
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/blog\/jiaia-ist-da$/)
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'article')
  const types = await page.locator('script[type="application/ld+json"]').evaluateAll((s) => s.map((x) => JSON.parse(x.textContent!)['@type']))
  expect(types).toEqual(['BlogPosting', 'BreadcrumbList'])
  await expect(page.locator('.blog-article-body')).toContainText('App Store')
  await page.goto('/anmelden')
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
})

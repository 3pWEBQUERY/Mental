import { expect, test } from '@playwright/test'

test('404 erklärt ruhig und zeigt die Notfallnummern', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()))
  const res = await page.goto('/diese-seite-gibt-es-nicht')
  expect(res?.status()).toBe(404)
  await expect(page.getByRole('heading', { name: /gibt es nicht/ })).toBeVisible()
  for (const nr of ['143', '147', '144']) await expect(page.locator(`a[href="tel:${nr}"]`)).toBeVisible()
  await expect(page.getByRole('link', { name: 'Zurück zu Jiaia' })).toBeVisible()
  // Die Seite muss auch unter der strengen CSP funktionieren (Umschalter reagiert = hydriert).
  await page.getByRole('button', { name: 'Dunkles Farbschema' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  expect(errors.filter((e) => e.includes('Content Security Policy'))).toEqual([])
})

test('Alte /lichtung-Links führen dauerhaft auf /start', async ({ request }) => {
  const res = await request.get('/lichtung/gedanke/abc?x=1', { maxRedirects: 0 })
  expect(res.status()).toBe(308)
  expect(res.headers()['location']).toMatch(/\/start\/gedanke\/abc\?x=1$/)
})

import { expect, test } from '@playwright/test'
import { register } from './helpers'

test('Seitensprache folgt der Navigation im Browser (/aide → Startseite)', async ({ page }) => {
  await page.goto('/aide')
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr-CH')
  await page.locator('header a[href="/"]').first().click()
  await page.waitForURL((u) => u.pathname === '/')
  await expect(page.locator('html')).toHaveAttribute('lang', 'de-CH')
})

test('Offene Endpunkte: Worker-Zustand ohne Zahlen, Präsenz nur angemeldet, keine Abmeldung durch Fremde', async ({ page, request }) => {
  const worker = await request.get('/api/health/worker')
  expect(Object.keys(await worker.json())).toEqual(['ok'])
  const presence = await request.post('/api/v1/presenceCounts', { headers: { 'content-type': 'application/json' }, data: {} })
  expect((await presence.json()).result).toEqual({})

  await register(page)
  // Ein fremder Link auf /api/session/clear meldet nicht ab.
  await page.goto('/api/session/clear')
  await page.waitForURL('**/start')
  await page.goto('/einstellungen')
  await expect(page.getByRole('button', { name: 'Abmelden', exact: true })).toBeVisible()
  // Schnell-Ausblenden nur von der eigenen Seite.
  const cross = await page.request.post('/api/panic', { headers: { origin: 'https://boese.example', 'sec-fetch-site': 'cross-site' } })
  expect(cross.status()).toBe(403)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Abmelden', exact: true })).toBeVisible()
})

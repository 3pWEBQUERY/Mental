import { expect, test } from '@playwright/test'
import { Pool } from 'pg'
import { openComposer, PASSWORD, register, share } from './helpers'

async function sql<T = Record<string, unknown>>(text: string, params: unknown[] = []) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  try {
    return (await pool.query(text, params)).rows as T[]
  } finally {
    await pool.end()
  }
}

test('Gedanken-Fenster: nach abgebrochenem Bearbeiten beginnt «Teilen» leer', async ({ page }) => {
  await register(page)
  const text = `Ein Gedanke zum Bearbeiten ${Date.now()}`
  await share(page, text)
  const card = page.locator('article', { hasText: text })
  await card.getByRole('button', { name: 'Weitere Aktionen' }).click()
  await page.getByRole('menuitem', { name: 'Bearbeiten' }).click()
  await expect(page.locator('#composer-text')).toHaveValue(text)
  await page.keyboard.press('Escape')
  await expect(page.locator('#composer-text')).toHaveCount(0)
  await openComposer(page)
  await expect(page.locator('#composer-text')).toHaveValue('')
})

test('Notfallplan: Nummern zum Antippen, «Abbrechen» verwirft Änderungen', async ({ page }) => {
  await register(page)
  await page.goto('/ich?tab=fuermich')
  await page.getByLabel(/Wen ich um Hilfe bitten kann/).fill('Mia 079 123 45 67, sonst 143')
  await page.getByRole('button', { name: 'Speichern' }).click()
  const view = page.locator('.plan-print')
  await expect(view.locator('a[href="tel:0791234567"]')).toHaveText('079 123 45 67')
  await expect(view.locator('a[href="tel:143"]')).toBeVisible()
  await page.getByRole('button', { name: 'Bearbeiten' }).click()
  await page.getByLabel(/Wen ich um Hilfe bitten kann/).fill('Etwas ganz anderes')
  await page.getByRole('button', { name: 'Abbrechen' }).click()
  await expect(view).toContainText('Mia 079 123 45 67')
  await expect(view).not.toContainText('Etwas ganz anderes')
})

test('Antwortzähler zählt Antworten von Konten in Löschung nicht mit', async ({ browser }) => {
  const a = await (await browser.newContext()).newPage()
  await register(a)
  const text = `Gedanke für den Zähler ${Date.now()}`
  await share(a, text)
  const b = await (await browser.newContext()).newPage()
  await register(b)
  await b.goto('/start')
  const card = b.locator('article', { hasText: text })
  await card.locator('.reply-toggle').click()
  await card.getByLabel('Antwort schreiben').fill('Ich höre dich.')
  await card.getByRole('button', { name: 'Antwort senden' }).click()
  await expect(card.getByText('Ich höre dich.')).toBeVisible()
  const count = async () => (await sql<{ n: number }>(`SELECT reply_count AS n FROM posts WHERE body = $1`, [text]))[0]!.n
  expect(await count()).toBe(1)
  await b.goto('/einstellungen')
  await b.getByLabel('Mit Passwort bestätigen').fill(PASSWORD)
  await b.getByRole('button', { name: 'Konto löschen' }).click()
  await b.getByRole('dialog').getByRole('button', { name: 'Konto löschen' }).click()
  await b.waitForURL((u) => u.pathname === '/')
  await expect.poll(count).toBe(0)
})

test('Offline: Hilfeseite bleibt erreichbar und gestaltet', async ({ page, context }) => {
  await page.goto('/hilfe')
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('/sw.js', { scope: '/' })
    await navigator.serviceWorker.ready
  })
  // Warten, bis die Hilfeseiten samt CSS im Zwischenspeicher liegen.
  await expect
    .poll(async () => page.evaluate(async () => (await (await caches.open('jiaia-assets-v1')).keys()).length), { timeout: 20_000 })
    .toBeGreaterThan(0)
  const online = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  await context.setOffline(true)
  await page.goto('/hilfe')
  await expect(page.locator('a[href="tel:143"]').first()).toBeVisible()
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(online)
  await context.setOffline(false)
})

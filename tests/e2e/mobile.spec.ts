import { expect, test } from '@playwright/test'
import { register } from './helpers'

test('Mobil: untere Navigation, Raum oben, kein horizontales Scrollen', async ({ page }) => {
  await register(page)
  await expect(page.locator('nav.rail')).toBeVisible()
  const box = await page.locator('nav.rail').boundingBox()
  expect(box!.y).toBeGreaterThan(700)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})

test('Mobil: Kreise samt «gerade hier» und der kleine Schritt sind erreichbar', async ({ page }) => {
  await register(page)
  await expect(page.locator('.step-inline .step')).toBeVisible()
  await page.locator('nav.rail').getByRole('button', { name: 'Kreise' }).click()
  const dlg = page.getByRole('dialog', { name: 'Kreise' })
  await expect(dlg.getByRole('link', { name: /Angst/ })).toBeVisible()
  await dlg.getByRole('link', { name: /Angst/ }).click()
  await page.waitForURL('**kreis=angst**')
  await expect(page.locator('.filter')).toContainText('Angst')
})

test('Mobil: Kopf der öffentlichen Seiten mit Sprachumschalter passt ohne seitliches Scrollen', async ({ page }) => {
  for (const path of ['/', '/hilfe', '/aide', '/aiuto']) {
    await page.goto(path)
    await expect(page.locator('.lang-switch').first()).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow, path).toBeLessThanOrEqual(0)
  }
})

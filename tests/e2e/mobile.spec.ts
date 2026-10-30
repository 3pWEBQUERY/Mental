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

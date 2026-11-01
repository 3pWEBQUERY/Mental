import { expect, test } from '@playwright/test'
import { register } from './helpers'

test('Mobil: schwebende Navigation – Reiter, Aktionen, Glocke und Notausgang; kein horizontales Scrollen', async ({ page }) => {
  await register(page)
  await expect(page.locator('nav.rail')).toBeHidden()
  const tabs = page.getByRole('navigation', { name: 'Hauptnavigation' })
  await expect(tabs).toBeVisible()
  const box = await tabs.boundingBox()
  expect(box!.y).toBeGreaterThan(700)
  await expect(tabs.getByRole('link', { name: 'Jiaia' })).toHaveAttribute('aria-current', 'page')
  // Reiter wechseln: der aktive folgt der Seite.
  await tabs.getByRole('link', { name: 'Ich' }).click()
  await page.waitForURL('**/ich')
  await expect(tabs.getByRole('link', { name: 'Ich' })).toHaveAttribute('aria-current', 'page')
  await tabs.getByRole('link', { name: 'Einstellungen' }).click()
  await page.waitForURL('**/einstellungen')
  // Aktionen: Sofort Hilfe und Teilen öffnen ihre Dialoge.
  await page.getByRole('button', { name: 'Sofort Hilfe' }).click()
  await expect(page.getByRole('dialog', { name: 'Sofort Hilfe' })).toBeVisible()
  await page.keyboard.press('Escape')
  // Glocke und Notausgang sind oben rechts immer da.
  await expect(page.locator('.mnav-top').getByRole('button', { name: /Benachrichtigungen/ })).toBeVisible()
  await expect(page.locator('.mnav-top').getByRole('button', { name: 'Schnell ausblenden' })).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})

test('Mobil: Kreise samt «gerade hier» und der kleine Schritt sind erreichbar', async ({ page }) => {
  await register(page)
  await expect(page.locator('.step-inline .step')).toBeVisible()
  await page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('button', { name: 'Kreise' }).click()
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

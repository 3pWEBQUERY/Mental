import { devices, expect, test } from '@playwright/test'

const iphone = { ...devices['iPhone 14'], locale: 'de-CH' }
delete (iphone as { defaultBrowserType?: string }).defaultBrowserType

test('App-Hinweis am iPhone: Blatt mit App-Store-Link, einmal – nicht auf Hilfe und Anmelden', async ({ browser }) => {
  const ctx = await browser.newContext(iphone)
  const page = await ctx.newPage()
  await page.goto('/')
  const sheet = page.getByRole('dialog', { name: 'Jiaia, immer in Reichweite.' })
  await expect(sheet).toBeVisible({ timeout: 6_000 })
  await expect(sheet).toContainText('Für iPhone und iPad')
  await expect(sheet.getByRole('link', { name: /App Store/ })).toHaveAttribute('href', 'https://apps.apple.com/ch/app/jiaia/id6829498048')
  // Kein seitliches Scrollen, das Blatt sitzt unten am Bildschirm.
  const box = (await sheet.boundingBox())!
  expect(Math.round(box.y + box.height)).toBeGreaterThanOrEqual(page.viewportSize()!.height - 1)
  await sheet.getByRole('button', { name: 'Im Browser weiter' }).click()
  await expect(sheet).toBeHidden()

  // Einmal gezeigt → beim nächsten Besuch Ruhe.
  await page.reload()
  await page.waitForTimeout(2_500)
  await expect(page.locator('dialog.app-sheet')).toHaveCount(0)
  await ctx.close()

  // Nie auf der Hilfe und nie beim Anmelden.
  for (const path of ['/hilfe', '/anmelden']) {
    const c = await browser.newContext(iphone)
    const p = await c.newPage()
    await p.goto(path)
    await p.waitForTimeout(2_500)
    await expect(p.locator('dialog.app-sheet')).toHaveCount(0)
    await c.close()
  }
})

test('App-Hinweis: nicht am Computer und nicht auf Android', async ({ browser }) => {
  for (const opts of [{}, { ...devices['Pixel 7'] }]) {
    const c = await browser.newContext(opts)
    const p = await c.newPage()
    await p.goto('/')
    await p.waitForTimeout(2_500)
    await expect(p.locator('dialog.app-sheet')).toHaveCount(0)
    await c.close()
  }
})

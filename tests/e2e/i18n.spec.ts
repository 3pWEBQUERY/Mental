import { expect, test } from '@playwright/test'
import { closeExtraContexts, openComposer, PASSWORD, register } from './helpers'

test.afterEach(closeExtraContexts)

test('Französischer Browser: Landing und Anmeldung auf Französisch, Wechsel auf Deutsch über den Footer', async ({ browser }) => {
  const ctx = await browser.newContext({ locale: 'fr-CH' })
  const page = await ctx.newPage()
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr-CH')
  await expect(page.getByRole('link', { name: 'Se connecter' }).first()).toBeVisible()
  await page.goto('/anmelden')
  await expect(page.getByRole('button', { name: 'Se connecter', exact: true })).toBeVisible()
  await expect(page).toHaveTitle(/Se connecter/)
  await page.getByRole('link', { name: 'Auf Deutsch' }).click()
  await expect(page.getByRole('button', { name: 'Anmelden', exact: true })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'de-CH')
})

test('Sprache in den Einstellungen: ganze App auf Französisch, gilt nach neuer Anmeldung auch auf einem anderen Gerät', async ({ browser, page }) => {
  const { username } = await register(page)
  await page.goto('/einstellungen')
  await page.getByRole('radiogroup', { name: 'Sprache' }).getByRole('radio', { name: 'Français' }).click()
  await page.waitForURL('**/einstellungen')
  await expect(page.getByRole('radiogroup', { name: 'Langue' }).getByRole('radio', { name: 'Français' })).toHaveAttribute('aria-checked', 'true')
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr-CH')

  // Feed, Kreise und kleiner Schritt auf Französisch
  await page.goto('/lichtung')
  await expect(page.getByRole('button', { name: 'Partager une pensée' }).first()).toBeVisible()
  await expect(page.locator('body')).toContainText('Anxiété')

  // Krisensprache: französischer Hinweis und Hilfe mit La Main Tendue
  await openComposer(page, /Qu’est-ce que tu portes/)
  await page.locator('#composer-text').fill("J'ai envie de mourir")
  await expect(page.getByRole('dialog').locator('.care')).toContainText('143')
  await expect(page.getByRole('dialog').locator('.care')).toContainText('24 h sur 24')
  await page.keyboard.press('Escape')
  await page.locator('nav.rail').getByRole('button', { name: 'Aide immédiate' }).click()
  await expect(page.getByRole('dialog', { name: 'Aide immédiate' })).toContainText('La Main Tendue')
  await page.keyboard.press('Escape')

  // Neues Gerät (deutscher Browser): nach der Anmeldung gilt die Sprache des Kontos.
  const other = await (await browser.newContext({ locale: 'de-CH' })).newPage()
  await other.goto('/anmelden')
  await other.getByLabel('Benutzername').fill(username)
  await other.getByLabel('Passwort').fill(PASSWORD)
  await other.getByRole('button', { name: 'Anmelden', exact: true }).click()
  await other.waitForURL('**/lichtung')
  await other.reload()
  await expect(other.getByRole('button', { name: 'Partager une pensée' }).first()).toBeVisible()

  // Zurück auf Deutsch
  await page.goto('/einstellungen')
  await page.getByRole('radiogroup', { name: 'Langue' }).getByRole('radio', { name: 'Deutsch' }).click()
  await expect(page.getByRole('radiogroup', { name: 'Sprache' })).toBeVisible()
})

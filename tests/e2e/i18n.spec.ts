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
  await page.getByRole('group', { name: 'Langue' }).getByRole('link', { name: 'Deutsch' }).click()
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
  await page.goto('/start')
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
  await other.waitForURL('**/start')
  await other.reload()
  await expect(other.getByRole('button', { name: 'Partager une pensée' }).first()).toBeVisible()

  // Zurück auf Deutsch
  await page.goto('/einstellungen')
  await page.getByRole('radiogroup', { name: 'Langue' }).getByRole('radio', { name: 'Deutsch' }).click()
  await expect(page.getByRole('radiogroup', { name: 'Sprache' })).toBeVisible()
})

test('Italienischer Browser: Landing und Anmeldung auf Italienisch, Umschalter DE · FR · IT im Kopf', async ({ browser }) => {
  const ctx = await browser.newContext({ locale: 'it-CH' })
  const page = await ctx.newPage()
  await page.goto('/anmelden')
  await expect(page.locator('html')).toHaveAttribute('lang', 'it-CH')
  await expect(page.getByRole('button', { name: 'Accedi', exact: true })).toBeVisible()
  await expect(page).toHaveTitle(/Accedi/)
  const sw = page.getByRole('group', { name: 'Lingua' })
  await expect(sw.getByRole('link', { name: 'Italiano' })).toHaveAttribute('aria-current', 'true')
  // Wechsel auf Französisch und zurück – jeweils dieselbe Seite.
  await sw.getByRole('link', { name: 'Français' }).click()
  await expect(page.getByRole('button', { name: 'Se connecter', exact: true })).toBeVisible()
  await page.getByRole('group', { name: 'Langue' }).getByRole('link', { name: 'Italiano' }).click()
  await expect(page.getByRole('button', { name: 'Accedi', exact: true })).toBeVisible()
})

test('Italiano in den Einstellungen: App, Kreise, Krisenhinweis und Hilfe auf Italienisch', async ({ page }) => {
  await register(page)
  await page.goto('/einstellungen')
  await page.getByRole('radiogroup', { name: 'Sprache' }).getByRole('radio', { name: 'Italiano' }).click()
  await page.waitForURL('**/einstellungen')
  await expect(page.getByRole('radiogroup', { name: 'Lingua' }).getByRole('radio', { name: 'Italiano' })).toHaveAttribute('aria-checked', 'true')
  await expect(page.locator('html')).toHaveAttribute('lang', 'it-CH')

  await page.goto('/start')
  await expect(page.getByRole('button', { name: 'Condividi un pensiero' }).first()).toBeVisible()
  await expect(page.locator('body')).toContainText('Ansia')
  await openComposer(page, /Che cosa porti con te oggi/)
  await page.locator('#composer-text').fill('A volte voglio morire')
  await expect(page.getByRole('dialog').locator('.care')).toContainText('143')
  await page.keyboard.press('Escape')
  await page.locator('nav.rail').getByRole('button', { name: 'Aiuto immediato' }).click()
  await expect(page.getByRole('dialog', { name: 'Aiuto immediato' })).toContainText('Telefono Amico')
})

test('Englischer Browser: Landing, Anmeldung, Hilfe /help und Transparenz auf Englisch; Umschalter mit EN', async ({ browser }) => {
  const ctx = await browser.newContext({ locale: 'en-GB' })
  const page = await ctx.newPage()
  await page.goto('/anmelden')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en-CH')
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible()
  await expect(page).toHaveTitle(/Sign in/)
  const sw = page.getByRole('group', { name: 'Language' })
  await expect(sw.getByRole('link', { name: 'English' })).toHaveAttribute('aria-current', 'true')
  await page.goto('/help')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en-CH')
  await expect(page.locator('a[href="tel:143"]').first()).toBeVisible()
  await expect(page.locator('body')).toContainText('Helping Hand')
  await page.goto('/transparenz')
  await expect(page.getByRole('heading', { name: 'What we promise' })).toBeVisible()
  // Wechsel auf Deutsch und zurück.
  await page.goto('/anmelden')
  await page.getByRole('group', { name: 'Language' }).getByRole('link', { name: 'Deutsch' }).click()
  await expect(page.getByRole('button', { name: 'Anmelden', exact: true })).toBeVisible()
  await page.getByRole('group', { name: 'Sprache' }).getByRole('link', { name: 'English' }).click()
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible()
})

test('English in den Einstellungen: App, Kreise, Krisenhinweis und Hilfe auf Englisch', async ({ page }) => {
  await register(page)
  await page.goto('/einstellungen')
  await page.getByRole('radiogroup', { name: 'Sprache' }).getByRole('radio', { name: 'English' }).click()
  await page.waitForURL('**/einstellungen')
  await expect(page.getByRole('radiogroup', { name: 'Language' }).getByRole('radio', { name: 'English' })).toHaveAttribute('aria-checked', 'true')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en-CH')

  await page.goto('/start')
  await expect(page.getByRole('button', { name: 'Share a thought' }).first()).toBeVisible()
  await expect(page.locator('body')).toContainText('Anxiety')
  await openComposer(page, /What are you carrying with you today/)
  await page.locator('#composer-text').fill('Sometimes I want to kill myself')
  await expect(page.getByRole('dialog').locator('.care')).toContainText('143')
  await page.keyboard.press('Escape')
  await page.locator('nav.rail').getByRole('button', { name: 'Help now' }).click()
  await expect(page.getByRole('dialog', { name: 'Help now' })).toContainText('Helping Hand')
})

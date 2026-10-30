import { expect, test } from '@playwright/test'
import { login, PASSWORD, register } from './helpers'

test('Registrierung ohne E-Mail, Abmelden, Anmelden', async ({ page }) => {
  const { username } = await register(page, 'Mira')
  await expect(page.getByRole('heading', { name: 'Gedanken' })).toBeVisible()
  await page.goto('/einstellungen')
  await page.getByRole('button', { name: 'Abmelden', exact: true }).click()
  await page.waitForURL('**/anmelden')

  await login(page, username, 'falsches passwort 123')
  await expect(page.locator('.error')).toContainText('stimmen nicht')
  await login(page, username)
  await page.waitForURL('**/lichtung')
})

test('Geschützte Seiten leiten auf die Anmeldung', async ({ page }) => {
  await page.goto('/ich')
  await expect(page).toHaveURL(/\/anmelden$/)
})

test('Wiederherstellen mit dem Schlüssel setzt ein neues Passwort und erzeugt einen neuen Schlüssel', async ({ page, browser }) => {
  const { username, words } = await register(page)
  const other = await browser.newPage()
  await other.goto('/wiederherstellen')
  await other.getByLabel('Benutzername').fill(username)
  await other.getByLabel('Wiederherstellungsschlüssel').fill(words.join(' ').toUpperCase())
  await other.getByLabel('Neues Passwort').fill(`${PASSWORD} neu`)
  await other.getByRole('button', { name: 'Weiter' }).click()
  await expect(other.getByRole('heading', { name: 'Dein neuer Schlüssel' })).toBeVisible()
  const fresh = await other.locator('.key-grid li').allTextContents()
  expect(fresh).toHaveLength(12)
  expect(fresh).not.toEqual(words)
  // Die alte Sitzung ist beendet.
  await page.goto('/ich')
  await expect(page).toHaveURL(/\/anmelden$/)
})

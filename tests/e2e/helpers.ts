import { expect, type Page } from '@playwright/test'

export const PASSWORD = 'ein ruhiger langer satz 2026'

export function uniqueName(prefix = 'e2e') {
  return `${prefix}.${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`
}

/** Durchläuft die komplette Registrierung und landet in der Lichtung. Gibt Benutzername und Schlüssel zurück. */
export async function register(page: Page, displayName = 'Testperson') {
  const username = uniqueName()
  await page.goto('/registrieren')
  await page.getByRole('button', { name: 'Weiter' }).click()
  await page.getByRole('button', { name: 'Weiter' }).click()
  await page.getByLabel('Ich halte mich an die Hausregeln.').check()
  await page.getByRole('button', { name: 'Weiter' }).click()
  await page.getByLabel(/mindestens 16 Jahre/).check()
  await page.getByRole('button', { name: 'Weiter' }).click()
  await page.getByLabel('Benutzername').fill(username)
  await page.getByRole('button', { name: 'Weiter' }).click()
  await page.locator('#pw').fill(PASSWORD)
  await page.locator('#pw2').fill(PASSWORD)
  await page.getByRole('button', { name: 'Weiter' }).click()
  await expect(page.locator('.key-grid li')).toHaveCount(12)
  const words = await page.locator('.key-grid li').allTextContents()
  await page.getByRole('button', { name: /Aufgeschrieben/ }).click()
  for (let i = 0; i < 2; i++) {
    const label = await page.locator(`label[for="w${i}"]`).textContent()
    await page.locator(`#w${i}`).fill(words[Number(label!.replace(/\D/g, '')) - 1]!)
  }
  await page.getByRole('button', { name: 'Konto erstellen' }).click()
  await expect(page.getByRole('heading', { name: /Passkey|heissen/ })).toBeVisible({ timeout: 20_000 })
  if (await page.getByRole('button', { name: 'Später' }).isVisible()) await page.getByRole('button', { name: 'Später' }).click()
  await page.getByLabel('Anzeigename').fill(displayName)
  await page.getByRole('button', { name: 'In die Lichtung' }).click()
  await page.waitForURL('**/lichtung')
  return { username, words }
}

export async function login(page: Page, username: string, password = PASSWORD) {
  await page.goto('/anmelden')
  await page.getByLabel('Benutzername').fill(username)
  await page.getByLabel('Passwort').fill(password)
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click()
}

export async function share(page: Page, text: string, opts: { anonymous?: boolean } = {}) {
  await page.getByRole('button', { name: 'Was trägst du heute mit dir?' }).click()
  await page.locator('#composer-text').fill(text)
  const toggle = page.getByLabel(/Ganz anonym teilen/)
  if (opts.anonymous === false && (await toggle.isChecked())) await toggle.uncheck()
  if (opts.anonymous === true && !(await toggle.isChecked())) await toggle.check()
  await page.getByRole('button', { name: 'Teilen', exact: true }).click()
}

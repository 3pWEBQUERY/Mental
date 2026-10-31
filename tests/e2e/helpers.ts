import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test'

export const PASSWORD = 'ein ruhiger langer satz 2026'

export function uniqueName(prefix = 'e2e') {
  return `${prefix}.${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`
}

/** Durchläuft die komplette Registrierung und landet in der Lichtung. Gibt Benutzername und Schlüssel zurück. */
export async function register(page: Page, displayName = 'Testperson', opts: { keepOnboarding?: boolean } = {}) {
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
  if (!opts.keepOnboarding) await skipOnboarding(page)
  return { username, words }
}

/** Die Einführung beim ersten Besuch überspringen – und warten, bis der Server sich das gemerkt hat. */
export async function skipOnboarding(page: Page) {
  const dialog = page.getByRole('dialog', { name: 'Willkommen' })
  await expect(dialog).toBeVisible({ timeout: 10_000 })
  const saved = page.waitForResponse((r) => r.request().method() === 'POST' && r.request().headers()['next-action'] !== undefined)
  await dialog.getByRole('button', { name: 'Überspringen' }).click()
  await expect(dialog).toBeHidden()
  await saved
}

export async function login(page: Page, username: string, password = PASSWORD) {
  await page.goto('/anmelden')
  await page.getByLabel('Benutzername').fill(username)
  await page.getByLabel('Passwort').fill(password)
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click()
}

/**
 * Teilen-Dialog öffnen. Direkt nach einem Seitenwechsel kann der Klick vor der Hydrierung landen und verpufft –
 * dann erneut, bis das Textfeld da ist.
 */
export async function openComposer(page: Page, prompt: string | RegExp = 'Was trägst du heute mit dir?') {
  await expect(async () => {
    await page.getByRole('button', { name: prompt }).click()
    await expect(page.locator('#composer-text')).toBeVisible({ timeout: 2_000 })
  }).toPass({ timeout: 30_000 })
}

export async function share(page: Page, text: string, opts: { anonymous?: boolean } = {}) {
  await openComposer(page)
  await page.locator('#composer-text').fill(text)
  // Die Checkbox ist visuell versteckt – geklickt wird der sichtbare Schalter.
  const toggle = page.getByLabel(/Ganz anonym teilen/)
  if (opts.anonymous !== undefined && (await toggle.isChecked()) !== opts.anonymous) {
    await page.locator('label.switch', { hasText: 'Ganz anonym teilen' }).click()
    await expect(toggle).toBeChecked({ checked: opts.anonymous })
  }
  await page.getByRole('button', { name: 'Teilen', exact: true }).click()
}

/**
 * Selbst geöffnete Kontexte (zweites Konto) schliessen. Playwright tut das erst am Ende des Workers –
 * bis dahin rechnen ihre Seiten (Raum-Kugel, WebGL in Software) weiter, und spätere Tests werden zäh.
 */
export async function closeExtraContexts({ browser, context }: { browser: Browser; context: BrowserContext }) {
  await Promise.all(browser.contexts().filter((c) => c !== context).map((c) => c.close()))
}

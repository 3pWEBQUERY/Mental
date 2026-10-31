import { execSync } from 'node:child_process'
import { expect, test } from '@playwright/test'
import { register } from './helpers'

test('Moderation ohne Passkey-Sitzung: keine Daten, nur der Hinweis', async ({ page }) => {
  const { username } = await register(page)
  execSync(`npm run admin:grant -- ${username} admin`, { stdio: 'ignore' })
  for (const path of ['/admin', '/admin/bilder', '/admin/audit', '/admin/begriffe']) {
    // Gestreamt kommt die Umleitung im Dokument statt als 3xx – entscheidend ist: keine Daten der Seite.
    const html = await (await page.request.get(path, { maxRedirects: 0 })).text()
    expect(html).toContain('/admin/passkey')
    for (const marker of ['queue-item', 'image-review', '<table', 'Die Warteschlange ist leer']) expect(html).not.toContain(marker)
  }
  await page.goto('/admin/bilder')
  await page.waitForURL('**/admin/passkey')
  await expect(page.getByText('nur mit einem Passkey erreichbar')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Abmelden und mit Passkey anmelden' })).toBeVisible()
  await expect(page.locator('.tabs')).toHaveCount(0)
})

test('Moderationskonto: weiterer Passkey nur aus einer Passkey-Sitzung – das Passwort genügt nicht', async ({ page, context }) => {
  // Virtueller Authenticator (Chromium): Passkeys ohne echtes Gerät.
  const cdp = await context.newCDPSession(page)
  await cdp.send('WebAuthn.enable')
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true },
  })
  const { username } = await register(page)

  // Normales Konto, frische Sitzung: Passkey anlegen geht.
  await page.goto('/einstellungen')
  await page.getByRole('button', { name: 'Passkey hinzufügen' }).click()
  await expect(page.getByText('Passkey eingerichtet.')).toBeVisible()

  // Wird das Konto zum Moderationskonto, reicht die Passwort-Sitzung für einen weiteren Passkey nicht mehr.
  execSync(`npm run admin:grant -- ${username} mod`, { stdio: 'ignore' })
  await page.reload()
  await page.getByRole('button', { name: 'Passkey hinzufügen' }).click()
  await expect(page.getByText(/nur an, wenn du mit einem Passkey angemeldet bist/)).toBeVisible()
})

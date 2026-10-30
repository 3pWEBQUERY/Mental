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

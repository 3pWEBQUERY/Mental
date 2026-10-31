import { expect, test } from '@playwright/test'
import { login, register } from './helpers'

test('Hilfe ist ohne Anmeldung erreichbar, mit tel:-Links', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Sofort Hilfe' }).click()
  await expect(page).toHaveURL(/\/hilfe$/)
  for (const n of ['143', '147', '144']) await expect(page.locator(`a[href="tel:${n}"]`)).toBeVisible()
})

test('Hilfe ist in der App von jedem Screen einen Tipp entfernt', async ({ page }) => {
  await register(page)
  for (const path of ['/lichtung', '/ich', '/einstellungen']) {
    await page.goto(path)
    await page.getByRole('button', { name: 'Sofort Hilfe' }).click()
    await expect(page.getByRole('dialog')).toContainText('143')
    await page.keyboard.press('Escape')
  }
})

test('Dreimal Esc blendet Lichtung aus und beendet die Sitzung', async ({ page }) => {
  await page.route('https://www.meteoschweiz.admin.ch/**', (r) => r.fulfill({ body: '<title>Wetter</title>', contentType: 'text/html' }))
  await register(page)
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  await page.waitForURL(/meteoschweiz/)
  // Die Abmeldung geht per Beacon raus und kann unter Last einen Moment nach dem Seitenwechsel ankommen.
  await expect(async () => {
    await page.goto('/ich')
    await expect(page).toHaveURL(/\/anmelden$/, { timeout: 1_000 })
  }).toPass({ timeout: 15_000 })
})

test('Konto löschen – ein Login innerhalb von 7 Tagen bricht die Löschung ab', async ({ page }) => {
  const { username } = await register(page)
  await page.goto('/einstellungen')
  await page.getByLabel('Mit Passwort bestätigen').fill('ein ruhiger langer satz 2026')
  await page.getByRole('button', { name: 'Konto löschen' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Konto löschen' }).click()
  await page.waitForURL((u) => u.pathname === '/')
  await login(page, username)
  await page.waitForURL('**/lichtung')
  await expect(page.getByRole('status').filter({ hasText: 'Löschung' })).toBeVisible()
})

test('Entwurf bleibt nach Abmelden nicht auf dem Gerät', async ({ page }) => {
  const { username } = await register(page)
  await page.getByRole('button', { name: 'Was trägst du heute mit dir?' }).click()
  await page.locator('#composer-text').fill('Ganz privater Entwurf')
  await page.keyboard.press('Escape')
  // Der Entwurf liegt im Browser …
  await expect.poll(() => page.evaluate(() => localStorage.getItem('lichtung-draft'))).toContain('Ganz privater Entwurf')
  await page.goto('/einstellungen')
  await page.getByRole('button', { name: 'Abmelden', exact: true }).click()
  await page.waitForURL('**/anmelden')
  // … und ist nach dem Abmelden weg – die nächste Person am Gerät sieht ihn nicht.
  await expect.poll(() => page.evaluate(() => localStorage.getItem('lichtung-draft'))).toBeNull()
  await login(page, username)
  await page.waitForURL('**/lichtung')
  await page.getByRole('button', { name: 'Was trägst du heute mit dir?' }).click()
  await expect(page.locator('#composer-text')).toHaveValue('')
})

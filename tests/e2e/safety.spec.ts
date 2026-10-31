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

test('Transparenz: öffentliche Zahlen pro Quartal, ohne Anmeldung', async ({ page }) => {
  await page.goto('/transparenz')
  await expect(page.getByRole('heading', { name: 'Transparenz', level: 1 })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Quartal \d{4}/ }).first()).toBeVisible()
  await expect(page.getByText('Geteilte Gedanken').first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'Transparenz' })).toBeVisible()
})

test('Nachts ohne Bereitschaft sagt «Sofort Hilfe» ehrlich, dass das Team nicht online ist', async ({ page }) => {
  await register(page)
  // 23:30 Schweizer Zeit (MEZ = UTC+1)
  await page.clock.setFixedTime(new Date('2026-12-01T22:30:00Z'))
  await page.reload()
  await page.locator('nav.rail').getByRole('button', { name: 'Sofort Hilfe' }).click()
  const help = page.getByRole('dialog', { name: 'Sofort Hilfe' })
  await expect(help.locator('.night-note')).toContainText('nicht online')
  await page.keyboard.press('Escape')
  // Tagsüber kein Hinweis.
  await page.clock.setFixedTime(new Date('2026-12-01T10:00:00Z'))
  await page.reload()
  await page.locator('nav.rail').getByRole('button', { name: 'Sofort Hilfe' }).click()
  await expect(page.getByRole('dialog', { name: 'Sofort Hilfe' })).toBeVisible()
  await expect(page.locator('.night-note')).toHaveCount(0)
})

test('Aide immédiate: französische Hilfeseite ohne Anmeldung, verlinkt mit /hilfe', async ({ page }) => {
  await page.goto('/hilfe')
  await page.getByRole('link', { name: 'En français' }).click()
  await page.waitForURL('**/aide')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Aide')
  await expect(page.locator('.public[lang="fr-CH"]')).toBeVisible()
  const aide = page.locator('.public[lang="fr-CH"]')
  const mainTendue = aide.locator('a[href="tel:143"]', { hasText: 'La Main Tendue' })
  await expect(mainTendue).toBeVisible()
  await expect(aide.locator('a[href="tel:147"]')).toBeVisible()
  await expect(aide.locator('a[href="tel:144"]')).toContainText('Urgences')
  await expect(aide.locator('main')).not.toContainText('Dargebotene Hand')
  await page.getByRole('link', { name: 'Auf Deutsch' }).click()
  await page.waitForURL('**/hilfe')
  await expect(page.locator('.public:not([lang]) a[href="tel:143"]').first()).toContainText('Die Dargebotene Hand')
})

test('Krisensprache auf Französisch löst denselben Hinweis aus', async ({ page }) => {
  await register(page)
  await page.getByRole('button', { name: 'Was trägst du heute mit dir?' }).click()
  await page.locator('#composer-text').fill("Je n'en peux plus, j'ai envie de mourir")
  await expect(page.getByRole('dialog').locator('.care')).toContainText('143')
})

import { expect, test } from '@playwright/test'
import { closeExtraContexts, moderator } from './helpers'

test.afterEach(closeExtraContexts)

test('Blog: Admin schreibt mit Titelbild, veröffentlicht, Entwurf nur in der Vorschau, löscht', async ({ browser }) => {
  test.slow()
  const admin = await moderator(browser, 'admin')
  const reader = await (await browser.newContext()).newPage()
  const title = `Zuhören, ohne zu lösen ${Date.now()}`

  await admin.goto('/admin/blog')
  await admin.getByRole('link', { name: 'Neuer Beitrag' }).click()
  await admin.waitForURL('**/admin/blog/neu')
  await admin.getByLabel('Titel', { exact: true }).fill(title)
  await expect(admin.getByLabel('Adresse des Beitrags')).toHaveValue(/^zuhoeren-ohne-zu-loesen-\d+$/)
  await admin.getByLabel('Kurzbeschreibung').fill('Warum ein «Ich höre dich» oft mehr trägt als jeder gute Rat.')
  await admin.getByLabel('Text des Beitrags').fill('Einleitung mit **Betonung**.\n\n## Was hilft\n\n- Da sein\n- Nachfragen\n\n<script>alert(1)</script>')
  await admin.locator('input[type="file"]').setInputFiles('components/landing/hero-poster.webp')
  await expect(admin.locator('img.be-cover')).toBeVisible({ timeout: 20_000 })
  await admin.getByLabel('Bildbeschreibung').fill('Sternenhimmel über einer Person')
  await admin.getByRole('button', { name: 'Veröffentlichen' }).click()
  await admin.waitForURL(/\/admin\/blog\/[0-9a-f-]{36}$/)
  await expect(admin.locator('.be-status:visible')).toHaveText('Veröffentlicht')
  const slug = await admin.getByLabel('Adresse des Beitrags').filter({ visible: true }).inputValue()

  // Öffentlich: im Blog, auf der Startseite, als Artikel – Text als Text, nie als HTML.
  await reader.goto('/blog')
  await expect(reader.getByRole('heading', { name: title })).toBeVisible()
  await reader.goto('/')
  await expect(reader.getByRole('region', { name: 'Aus dem Blog' }).getByRole('link', { name: title })).toBeVisible()
  await reader.getByRole('link', { name: title }).click()
  await reader.waitForURL(`**/blog/${slug}`)
  await expect(reader.getByRole('heading', { level: 1 })).toHaveText(title)
  await expect(reader.getByRole('heading', { name: 'Was hilft' })).toBeVisible()
  await expect(reader.locator('.blog-article-body strong')).toHaveText('Betonung')
  await expect(reader.locator('.blog-article-body')).toContainText('<script>alert(1)</script>')
  await expect.poll(() => reader.locator('.blog-article-cover img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
  await expect(reader.locator('.blog-article-cover img')).toHaveAttribute('alt', 'Sternenhimmel über einer Person')
  await expect(reader.getByRole('link', { name: 'Sofort Hilfe' }).last()).toBeVisible()

  // Zurück zum Entwurf: öffentlich weg, für das Admin-Team als Vorschau.
  await admin.getByRole('button', { name: 'Zurück zum Entwurf' }).click()
  // Das Formular für einen neuen Beitrag ist danach leer (es bleibt im Hintergrund erhalten).

  await expect(admin.locator('.be-status:visible')).toHaveText('Entwurf')
  await reader.goto(`/blog/${slug}`)
  await expect(reader.getByRole('heading', { level: 1 })).toContainText('gibt es nicht')
  await admin.goto(`/blog/${slug}?vorschau=1`)
  await expect(admin.getByText('Entwurf – nur für das Team sichtbar.')).toBeVisible()

  // Löschen.
  await admin.goto('/admin/blog')
  await admin.getByRole('link', { name: title }).click()
  await admin.getByRole('button', { name: 'Beitrag löschen' }).click()
  await admin.getByRole('dialog').getByRole('button', { name: 'Löschen' }).click()
  await admin.waitForURL(/\/admin\/blog$/)
  await expect(admin.getByRole('link', { name: title })).toHaveCount(0)
})

test('Blog: ohne Beiträge ein ruhiger Hinweis, kein leerer Bereich auf der Startseite', async ({ page }) => {
  await page.goto('/blog')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Neues und')
  await page.goto('/')
  // Aus anderen Tests können Beiträge da sein – dann muss der Bereich Inhalt haben.
  const teaser = page.getByRole('region', { name: 'Aus dem Blog' })
  if (await teaser.count()) await expect(teaser.locator('article').first()).toBeVisible()
})

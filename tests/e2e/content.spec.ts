import { expect, test } from '@playwright/test'
import { register, share } from './helpers'

test('Teilen, Zuspruch, Antworten, Benachrichtigung, «Das hat mir gutgetan»', async ({ browser }) => {
  const a = await (await browser.newContext()).newPage()
  const b = await (await browser.newContext()).newPage()
  await register(a, 'Autorin')
  await register(b, 'Jonas')

  const text = `Heute war ein schwerer Tag ${Date.now()}`
  await share(a, text, { anonymous: true })
  const mine = a.locator('article', { hasText: text })
  await expect(mine.locator('.who')).toHaveText('Anonym (du)')
  await expect(mine).toContainText('Noch kein Zuspruch')

  await b.goto('/lichtung?ansicht=unheard')
  const card = b.locator('article', { hasText: text })
  await expect(card).toContainText('Noch ohne Antwort')
  // Keine öffentlichen Zahlen: Zuspruch ist ohne Zähler.
  await card.getByRole('button', { name: 'Ich höre dich' }).click()
  await expect(card.getByRole('button', { name: 'Ich höre dich' })).toHaveAttribute('aria-pressed', 'true')
  await card.locator('.reply-toggle').click()
  await expect(card).toContainText('Diese Person wünscht sich gerade keine Ratschläge.')
  await card.getByRole('button', { name: 'Du bist damit nicht allein.' }).click()
  await card.getByRole('button', { name: 'Antwort senden' }).click()
  await expect(card.locator('.reply')).toContainText('Du bist damit nicht allein.')

  await a.reload()
  const after = a.locator('article', { hasText: text })
  await expect(after).toContainText('1 Mensch hat dir Zuspruch geschickt')
  await a.getByRole('button', { name: /Benachrichtigungen/ }).click()
  await expect(a.getByRole('dialog')).toContainText('Jemand hat dir geantwortet')
  await a.keyboard.press('Escape')

  await after.locator('.reply-toggle').click()
  await after.getByRole('button', { name: 'Das hat mir gutgetan' }).click()
  await a.goto('/ich?tab=gutgetan')
  await expect(a.locator('.saved-reply')).toContainText('Du bist damit nicht allein.')
})

test('Krisensprache: Hinweis beim Tippen, Vollbild nach dem Teilen, nur für die Autorin sichtbar', async ({ browser }) => {
  const a = await (await browser.newContext()).newPage()
  const b = await (await browser.newContext()).newPage()
  await register(a)
  await register(b)
  const text = `Ich will nicht mehr leben ${Date.now()}`
  await a.getByRole('button', { name: 'Was trägst du heute mit dir?' }).click()
  await a.locator('#composer-text').fill(text)
  await expect(a.getByRole('dialog').locator('.care')).toContainText('143')
  await a.getByRole('button', { name: 'Teilen', exact: true }).click()
  await expect(a.getByRole('heading', { name: /Du bist nicht/ })).toBeVisible()
  await expect(a.locator('a[href="tel:144"]').first()).toBeVisible()
  await a.getByRole('button', { name: 'Ich bleibe noch in der App' }).click()
  await expect(a.locator('article', { hasText: text })).toContainText('Nur für dich sichtbar')

  await b.goto('/lichtung')
  await expect(b.locator('article', { hasText: text })).toHaveCount(0)
})

test('Persönliche Daten werden markiert', async ({ page }) => {
  await register(page)
  await page.getByRole('button', { name: 'Was trägst du heute mit dir?' }).click()
  await page.locator('#composer-text').fill('Schreib mir: 079 123 45 67')
  await expect(page.locator('.pii')).toContainText('Telefonnummer')
  await expect(page.locator('.hl mark')).toHaveText('079 123 45 67')
})

test('Melden mit «Ich mache mir Sorgen» zeigt, wie man selbst reagieren kann', async ({ browser }) => {
  const a = await (await browser.newContext()).newPage()
  const b = await (await browser.newContext()).newPage()
  await register(a)
  await register(b)
  const text = `Ich weiss gerade nicht weiter ${Date.now()}`
  await share(a, text)
  await b.goto('/lichtung')
  const card = b.locator('article', { hasText: text })
  await card.getByRole('button', { name: 'Weitere Aktionen' }).click()
  await b.getByRole('menuitem', { name: 'Melden' }).click()
  await expect(b.getByLabel('Ich mache mir Sorgen um diese Person')).toBeChecked()
  await b.getByRole('dialog').getByRole('button', { name: 'Melden' }).click()
  await expect(b.getByRole('heading', { name: 'Was du jetzt tun kannst' })).toBeVisible()
})

test('Blockieren lässt Inhalte verschwinden', async ({ browser }) => {
  const a = await (await browser.newContext()).newPage()
  const b = await (await browser.newContext()).newPage()
  await register(a)
  await register(b)
  const text = `Ein Gedanke zum Blockieren ${Date.now()}`
  await share(a, text)
  await b.goto('/lichtung')
  const card = b.locator('article', { hasText: text })
  await card.getByRole('button', { name: 'Weitere Aktionen' }).click()
  await b.getByRole('menuitem', { name: 'Blockieren' }).click()
  await b.getByRole('dialog').getByRole('button', { name: 'Blockieren' }).click()
  await expect(card).toHaveCount(0)
  await b.reload()
  await expect(b.locator('article', { hasText: text })).toHaveCount(0)
})

test('Löschen ist sofort und endgültig', async ({ page }) => {
  await register(page)
  const text = `Wird gleich gelöscht ${Date.now()}`
  await share(page, text)
  const card = page.locator('article', { hasText: text })
  await card.getByRole('button', { name: 'Weitere Aktionen' }).click()
  await page.getByRole('menuitem', { name: 'Löschen' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Löschen' }).click()
  await expect(card).toHaveCount(0)
  await page.reload()
  await expect(page.locator('article', { hasText: text })).toHaveCount(0)
})

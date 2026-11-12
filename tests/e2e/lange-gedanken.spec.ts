import { expect, test } from '@playwright/test'
import { openComposer, register, share } from './helpers'

test('Lange Gedanken: bis 3000 Zeichen, im Feed gekürzt mit «Weiterlesen», geöffnet ganz', async ({ browser }) => {
  const page = await browser.newPage()
  await register(page)
  const id = Date.now()
  const end = `Das ist der letzte Satz ${id}.`
  const body = `Anfang ${id}. ` + 'Heute war ein langer Tag, und ich möchte einfach aufschreiben, was mir alles durch den Kopf geht. '.repeat(15) + end
  expect(body.length).toBeGreaterThan(1400)

  // Das Schreibfeld nimmt viel mehr als früher (600) und zeigt die neue Grenze.
  await share(page, body)
  const card = page.locator('article:visible', { hasText: `Anfang ${id}` })
  await expect(card).toBeVisible()
  const text = card.locator('.post-text')
  await expect(text).toHaveClass(/clamped/)
  // Gekürzt: Der Absatz ist deutlich niedriger als sein ganzer Inhalt.
  expect(await text.evaluate((el) => el.scrollHeight > el.clientHeight + 20)).toBe(true)

  await card.getByRole('button', { name: 'Weiterlesen' }).click()
  const dlg = page.getByRole('dialog')
  await expect(dlg.locator('.post-text')).toContainText(end)
  await expect(dlg.locator('.post-text')).not.toHaveClass(/clamped/)
  expect(await dlg.locator('.post-text').evaluate((el) => el.scrollHeight <= el.clientHeight + 2)).toBe(true)
})

test('Schreibfeld: Zähler bis 3000, darüber schneidet das Feld ab', async ({ page }) => {
  await register(page)
  await openComposer(page)
  const area = page.locator('#composer-text')
  await expect(area).toHaveAttribute('maxlength', '3000')
  await area.fill('x'.repeat(10))
  await expect(page.locator('.composer .count')).toHaveText('10 / 3000')
})

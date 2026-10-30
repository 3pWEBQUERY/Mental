import { expect, test } from '@playwright/test'
import { Pool } from 'pg'
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

test('Krisensprache in einer Antwort: Vollbild-Hinweis, Antwort wartet auf Prüfung', async ({ browser }) => {
  const a = await (await browser.newContext()).newPage()
  const b = await (await browser.newContext()).newPage()
  await register(a)
  await register(b)
  const text = `Ein Gedanke für eine Antwort ${Date.now()}`
  await share(a, text)
  await b.goto('/lichtung')
  const card = b.locator('article', { hasText: text })
  await card.locator('.reply-toggle').click()
  await card.getByLabel('Antwort schreiben').fill('Mir geht es auch so, ich will nicht mehr leben')
  await expect(card.locator('.care')).toContainText('143')
  await card.getByRole('button', { name: 'Antwort senden' }).click()
  const acute = b.getByRole('dialog', { name: /Du bist nicht/ })
  await expect(acute).toBeVisible()
  await expect(acute.locator('a[href="tel:144"]').first()).toBeVisible()
  await acute.getByRole('button', { name: 'Ich bleibe noch in der App' }).click()
  // Für andere erst nach der Prüfung sichtbar.
  await a.reload()
  await expect(a.locator('article', { hasText: text }).locator('.replies')).not.toContainText('ich will nicht mehr leben')
})

test('Eigene Antwort löschen und Antwortende blockieren', async ({ browser }) => {
  const a = await (await browser.newContext()).newPage()
  const b = await (await browser.newContext()).newPage()
  await register(a)
  await register(b, 'Lio')
  const text = `Ein Gedanke für Antworten ${Date.now()}`
  await share(a, text)
  await b.goto('/lichtung')
  const card = b.locator('article', { hasText: text })
  await card.locator('.reply-toggle').click()
  await card.getByLabel('Antwort schreiben').fill('Meine Nummer ist hier zu viel')
  await card.getByRole('button', { name: 'Antwort senden' }).click()
  await expect(card.locator('.replies')).toContainText('Meine Nummer ist hier zu viel')
  await card.locator('.reply-actions').getByRole('button', { name: 'Löschen' }).click()
  await b.getByRole('dialog').getByRole('button', { name: 'Löschen' }).click()
  await expect(card.locator('.replies')).not.toContainText('Meine Nummer ist hier zu viel')
  await card.getByLabel('Antwort schreiben').fill('Du schaffst das, wirklich.')
  await card.getByRole('button', { name: 'Antwort senden' }).click()

  // Die Autorin blockiert «Lio» direkt an der Antwort auf ihren eigenen Gedanken.
  await a.reload()
  const mine = a.locator('article', { hasText: text })
  await mine.locator('.reply-toggle').click()
  await expect(mine.locator('.replies')).toContainText('Du schaffst das, wirklich.')
  await expect(mine.locator('.replies')).not.toContainText('Meine Nummer ist hier zu viel')
  await mine.locator('.reply', { hasText: 'Du schaffst das' }).getByRole('button', { name: 'Blockieren' }).click()
  await a.getByRole('dialog').getByRole('button', { name: 'Blockieren' }).click()
  // Erst neu laden, wenn die Aktion durch ist – sonst bricht der Reload sie ab.
  await expect(mine.locator('.replies')).not.toContainText('Du schaffst das, wirklich.')
  await a.reload()
  await a.locator('article', { hasText: text }).locator('.reply-toggle').click()
  await expect(a.locator('article', { hasText: text }).locator('.replies')).not.toContainText('Du schaffst das, wirklich.')
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

test('Blockieren unter Namen trifft das Konto – anonyme Gedanken bleiben unverknüpft', async ({ browser }) => {
  const a = await (await browser.newContext()).newPage()
  const b = await (await browser.newContext()).newPage()
  await register(a, 'Mira')
  await register(b)
  const t = Date.now()
  const named = `Unter meinem Namen ${t}`
  const anon = `Ganz anonym ${t}`
  await share(a, named, { anonymous: false })
  await share(a, anon, { anonymous: true })

  await b.goto('/lichtung')
  const card = b.locator('article', { hasText: named })
  await card.getByRole('button', { name: 'Weitere Aktionen' }).click()
  await b.getByRole('menuitem', { name: 'Blockieren' }).click()
  await b.getByRole('dialog').getByRole('button', { name: 'Blockieren' }).click()
  await expect(card).toHaveCount(0)
  await b.reload()
  await expect(b.locator('article', { hasText: named })).toHaveCount(0)
  // Der anonyme Gedanke derselben Person bleibt – sonst liesse er sich «Mira» zuordnen.
  await expect(b.locator('article', { hasText: anon })).toHaveCount(1)
  // Auch umgekehrt: A sieht ihre eigenen Inhalte, B kann auf den anonymen Gedanken weiter reagieren.
  await b.locator('article', { hasText: anon }).getByRole('button', { name: 'Ich höre dich' }).click()
  await expect(b.locator('article', { hasText: anon }).getByRole('button', { name: 'Ich höre dich' })).toHaveAttribute('aria-pressed', 'true')
})

test('Anonymen Gedanken ausblenden trifft nur diesen Gedanken', async ({ browser }) => {
  const a = await (await browser.newContext()).newPage()
  const b = await (await browser.newContext()).newPage()
  await register(a, 'Noa')
  await register(b)
  const t = Date.now()
  const named = `Noa schreibt ${t}`
  const anon = `Anonym zum Ausblenden ${t}`
  await share(a, named, { anonymous: false })
  await share(a, anon, { anonymous: true })

  await b.goto('/lichtung')
  const card = b.locator('article', { hasText: anon })
  await card.getByRole('button', { name: 'Weitere Aktionen' }).click()
  await b.getByRole('menuitem', { name: 'Ausblenden' }).click()
  await b.getByRole('dialog').getByRole('button', { name: 'Ausblenden' }).click()
  await b.reload()
  await expect(b.locator('article', { hasText: anon })).toHaveCount(0)
  await expect(b.locator('article', { hasText: named })).toHaveCount(1)

  await b.goto('/einstellungen')
  await expect(b.getByText('Ein ausgeblendeter anonymer Gedanke')).toBeVisible()
  await b.getByRole('button', { name: 'Wieder zeigen' }).click()
  await b.goto('/lichtung')
  await expect(b.locator('article', { hasText: anon })).toHaveCount(1)
})

test('Löschen ist sofort und endgültig – auch in Benachrichtigungen', async ({ browser }) => {
  const a = await (await browser.newContext()).newPage()
  const b = await (await browser.newContext()).newPage()
  await register(a)
  await register(b)
  const text = `Wird gleich gelöscht ${Date.now()}`
  await share(a, text)
  // Eine Antwort erzeugt eine Benachrichtigung mit Auszug für die Verfasserin.
  await b.goto('/lichtung')
  const other = b.locator('article', { hasText: text })
  await other.locator('.reply-toggle').click()
  await other.getByRole('button', { name: 'Du bist damit nicht allein.' }).click()
  await other.getByRole('button', { name: 'Antwort senden' }).click()
  await expect(other.locator('.replies')).toContainText('Du bist damit nicht allein.')
  await expect.poll(() => excerpts(text)).toBe(1)

  const card = a.locator('article', { hasText: text })
  await card.getByRole('button', { name: 'Weitere Aktionen' }).click()
  await a.getByRole('menuitem', { name: 'Löschen' }).click()
  await a.getByRole('dialog').getByRole('button', { name: 'Löschen' }).click()
  await expect(card).toHaveCount(0)
  await a.reload()
  await expect(a.locator('article', { hasText: text })).toHaveCount(0)
  expect(await excerpts(text)).toBe(0)
})

async function excerpts(text: string) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  try {
    const r = await pool.query(`SELECT count(*)::int AS n FROM notifications WHERE payload->>'excerpt' LIKE $1`, [`%${text.slice(0, 30)}%`])
    return r.rows[0].n as number
  } finally {
    await pool.end()
  }
}

test('Gedanke per Klick gross öffnen – 75 % des Bildschirms, Antworten darin', async ({ page }) => {
  await register(page)
  const text = `Ein Gedanke zum Öffnen ${Date.now()}`
  await share(page, text)
  await page.locator('article', { hasText: text }).locator('.post-text').click()
  const dlg = page.locator('dialog[open]')
  await expect(dlg.getByRole('heading', { name: 'Gedanke' })).toBeVisible()
  await expect(dlg.locator('.post-text')).toHaveText(text)
  const box = (await dlg.boundingBox())!
  const vp = page.viewportSize()!
  expect(Math.abs(box.width / vp.width - 0.75)).toBeLessThan(0.01)
  expect(Math.abs(box.height / vp.height - 0.75)).toBeLessThan(0.01)

  await dlg.getByLabel('Antwort schreiben').fill('Danke, dass du das teilst.')
  await dlg.getByRole('button', { name: 'Antwort senden' }).click()
  await expect(dlg.locator('.replies')).toContainText('Danke, dass du das teilst.')
  await page.keyboard.press('Escape')
  await expect(page.locator('dialog[open]')).toHaveCount(0)
  // Die Karte im Feed hat die Antwort ebenfalls – ohne Neuladen.
  await expect(page.locator('.list article', { hasText: text }).locator('.replies')).toContainText('Danke, dass du das teilst.')
})

test('«Meine Kreise»: gefolgte Kreise als Filter', async ({ page }) => {
  await register(page)
  const t = Date.now()
  await page.goto('/einstellungen')
  // Erster Kreis aus der Liste auf «Folgen»
  const row = page.locator('.kv', { hasText: 'Angst' })
  await row.getByRole('radio', { name: 'Folgen' }).click()
  await expect(row.getByRole('radio', { name: 'Folgen' })).toHaveAttribute('aria-checked', 'true')
  await page.waitForLoadState('networkidle')
  await page.goto('/lichtung')
  const inAngst = `Angst-Gedanke ${t}`
  const elsewhere = `Trauer-Gedanke ${t}`
  for (const [text, circle] of [[inAngst, 'Angst'], [elsewhere, 'Trauer']] as const) {
    await page.getByRole('button', { name: 'Was trägst du heute mit dir?' }).click()
    await page.locator('#composer-text').fill(text)
    await page.getByRole('dialog').getByRole('button', { name: circle, exact: true }).click()
    await page.getByRole('button', { name: 'Teilen', exact: true }).click()
    await expect(page.locator('dialog[open]')).toHaveCount(0)
  }
  await page.getByRole('link', { name: /Meine Kreise/ }).first().click()
  await page.waitForURL('**kreis=meine**')
  await expect(page.locator('article', { hasText: inAngst })).toHaveCount(1)
  await expect(page.locator('article', { hasText: elsewhere })).toHaveCount(0)
})

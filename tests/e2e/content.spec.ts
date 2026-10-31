import { expect, test, type Page } from '@playwright/test'
import { Pool } from 'pg'
import { register, share, closeExtraContexts } from './helpers'

test.afterEach(closeExtraContexts)

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
  await expect(after.getByRole('button', { name: 'Das hat mir gutgetan' })).toHaveAttribute('aria-pressed', 'true')
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
  // Zwei Konten, zwei Seiten mit laufender Raum-Kugel (Software-WebGL): gegen Ende eines vollen Laufs
  // dauern Klicks hier bis zu 30 s. Einzeln ist der Test nach ~16 s fertig.
  test.slow()
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
  await expect(card).toHaveCount(0)
  await b.reload()
  await expect(b.locator('article', { hasText: anon })).toHaveCount(0)
  await expect(b.locator('article', { hasText: named })).toHaveCount(1)

  await b.goto('/einstellungen')
  await expect(b.getByText('Ein ausgeblendeter anonymer Gedanke')).toBeVisible()
  await b.getByRole('button', { name: 'Wieder zeigen' }).click()
  // Erst weiter, wenn die Aktion durch ist – sonst bricht die Navigation sie ab.
  await expect(b.getByText('Ein ausgeblendeter anonymer Gedanke')).toHaveCount(0)
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
    await page.getByRole('dialog').getByRole('radio', { name: circle, exact: true }).click()
    await page.getByRole('button', { name: 'Teilen', exact: true }).click()
    await expect(page.locator('dialog[open]')).toHaveCount(0)
  }
  await page.getByRole('link', { name: /Meine Kreise/ }).first().click()
  await page.waitForURL('**kreis=meine**')
  await expect(page.locator('article', { hasText: inAngst })).toHaveCount(1)
  await expect(page.locator('article', { hasText: elsewhere })).toHaveCount(0)
})

test('Tastatur: Menü, Bestätigung und Auswahlgruppen', async ({ page }) => {
  await register(page)
  const text = `Tastatur-Gedanke ${Date.now()}`
  // Auswahlgruppen: Pfeiltasten wählen die nächste Option
  await page.getByRole('button', { name: 'Was trägst du heute mit dir?' }).click()
  // Beim Öffnen steht der Cursor direkt im Textfeld, nicht auf «×».
  await expect(page.locator('#composer-text')).toBeFocused()
  const needs = page.getByRole('radiogroup', { name: 'Was brauchst du gerade?' })
  await needs.getByRole('radio', { checked: true }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(needs.getByRole('radio', { name: 'Ermutigung' })).toHaveAttribute('aria-checked', 'true')
  await expect(needs.getByRole('radio', { name: 'Ermutigung' })).toBeFocused()
  await page.locator('#composer-text').fill(text)
  await page.getByRole('button', { name: 'Teilen', exact: true }).click()
  await expect(page.locator('dialog[open]')).toHaveCount(0)

  // Gedanke gross öffnen, Menü per Tastatur: Esc schliesst nur das Menü
  await page.locator('article', { hasText: text }).locator('.post-text').click()
  const dlg = page.locator('dialog[open]')
  const dots = dlg.getByRole('button', { name: 'Weitere Aktionen' })
  await dots.focus()
  await page.keyboard.press('Enter')
  await expect(dlg.getByRole('menuitem').first()).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(dlg.getByRole('menuitem').nth(1)).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dlg.getByRole('menu')).toHaveCount(0)
  await expect(dots).toBeFocused()
  await expect(page.locator('dialog[open]')).toHaveCount(1)

  // Bestätigung: Fokus auf «Abbrechen», Enter löscht nichts
  await page.keyboard.press('Enter')
  await dlg.getByRole('menuitem', { name: 'Löschen' }).click()
  const confirm = page.getByRole('dialog', { name: 'Löschen' })
  await expect(confirm.getByRole('button', { name: 'Abbrechen' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(confirm).toHaveCount(0)
  await page.keyboard.press('Escape')
  await page.reload()
  await expect(page.locator('article', { hasText: text })).toHaveCount(1)
})

test('Ansichten-Leiste: Three.js-Tropfen fliesst zum gewählten Reiter, URL und Feed folgen', async ({ page }) => {
  await register(page)
  const nav = page.getByRole('navigation', { name: 'Ansicht' })
  // Mit WebGL übernimmt der Tropfen die Pille; die helle Schrift liegt als ausgeschnittene Kopie darüber.
  // Der Tropfen entsteht erst bei Annäherung – vorher die gleich aussehende CSS-Pille.
  await nav.hover()
  await expect(nav).toHaveClass(/blob-on/, { timeout: 20_000 })
  const ink = nav.locator('.blob-ink')
  const clip = () => ink.evaluate((el) => (el as HTMLElement).style.clipPath)
  await expect.poll(clip).toMatch(/^inset\(/)
  const before = await clip()

  await nav.getByRole('link', { name: 'Mut-Momente' }).click()
  // Sofort aktiv (optimistisch), dann bestätigt der Server die Ansicht.
  await expect(nav.getByRole('link', { name: 'Mut-Momente' })).toHaveAttribute('aria-current', 'page')
  await expect(page).toHaveURL(/ansicht=brave/)
  // Der Tropfen ist angekommen: Die Form liegt jetzt woanders.
  await expect.poll(clip).not.toBe(before)
  await expect(nav.getByRole('link', { name: 'Alle' })).not.toHaveAttribute('aria-current', 'page')
})

test('«Ich»-Reiter: derselbe Tropfen, Inhalt folgt', async ({ page }) => {
  await register(page)
  await page.goto('/ich')
  const nav = page.getByRole('navigation', { name: 'Ich', exact: true })
  // Der Tropfen entsteht erst bei Annäherung – vorher die gleich aussehende CSS-Pille.
  await nav.hover()
  await expect(nav).toHaveClass(/blob-on/, { timeout: 20_000 })
  await nav.getByRole('link', { name: 'Merkliste', exact: true }).click()
  await expect(nav.getByRole('link', { name: 'Merkliste', exact: true })).toHaveAttribute('aria-current', 'page')
  await expect(page).toHaveURL(/tab=merkliste/)
  await expect(nav.getByRole('link', { name: 'Verlauf', exact: true })).not.toHaveAttribute('aria-current', 'page')
})

test('Einstellungen: Auswahlgruppen mit Tropfen, Auswahl wirkt sofort', async ({ page }) => {
  await register(page)
  await page.goto('/einstellungen')
  const theme = page.getByRole('radiogroup', { name: 'Farbschema' })
  // Der Tropfen entsteht erst bei Annäherung – vorher die gleich aussehende CSS-Pille.
  await theme.hover()
  await expect(theme).toHaveClass(/blob-on/, { timeout: 20_000 })
  await theme.getByRole('radio', { name: 'Dunkel' }).click()
  await expect(theme.getByRole('radio', { name: 'Dunkel' })).toHaveAttribute('aria-checked', 'true')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  // Tastatur bleibt wie bei nativen Radios: Pfeil wählt die nächste Option.
  await page.keyboard.press('ArrowRight')
  await expect(theme.getByRole('radio', { name: 'System' })).toHaveAttribute('aria-checked', 'true')
})

test('Kreis-Auswahl: Tropfen in der Seitenleiste und beim Teilen', async ({ page }) => {
  await register(page)
  await page.goto('/lichtung')
  const list = page.locator('aside.side ul.circles')
  // Der Tropfen entsteht erst bei Annäherung – vorher die gleich aussehende CSS-Pille.
  await list.hover()
  await expect(list).toHaveClass(/blob-on/, { timeout: 20_000 })
  await list.getByRole('link', { name: /Angst/ }).click()
  await expect(list.getByRole('link', { name: /Angst/ })).toHaveAttribute('aria-current', 'true')
  await expect(page).toHaveURL(/kreis=angst/)
  // Nochmals tippen hebt den Filter auf – der Tropfen verschwindet.
  await list.getByRole('link', { name: /Angst/ }).click()
  await expect(page).not.toHaveURL(/kreis=/)
  await expect(list.locator('[aria-current="true"]')).toHaveCount(0)

  await page.getByRole('button', { name: 'Was trägst du heute mit dir?' }).click()
  const circle = page.getByRole('radiogroup', { name: 'In welchem Kreis?' })
  // Der Tropfen entsteht erst bei Annäherung – vorher die gleich aussehende CSS-Pille.
  await circle.hover()
  await expect(circle).toHaveClass(/blob-on/, { timeout: 20_000 })
  await circle.getByRole('radio', { name: 'Trauer' }).click()
  await expect(circle.getByRole('radio', { name: 'Trauer' })).toHaveAttribute('aria-checked', 'true')
})

test('Stimmungs-Auswahl: Tropfen im Raum und beim Teilen', async ({ page }) => {
  await register(page)
  await page.goto('/lichtung')
  const mood = page.getByRole('radiogroup', { name: 'Stimmung' })
  // Der Tropfen entsteht erst bei Annäherung – vorher die gleich aussehende CSS-Pille.
  await mood.hover()
  await expect(mood).toHaveClass(/blob-on/, { timeout: 20_000 })
  await mood.getByRole('radio', { name: 'Leichter' }).click()
  await expect(mood.getByRole('radio', { name: 'Leichter' })).toHaveAttribute('aria-checked', 'true')
  await mood.getByRole('radio', { name: 'Müde' }).click()
  await expect(mood.getByRole('radio', { name: 'Müde' })).toHaveAttribute('aria-checked', 'true')

  await page.getByRole('button', { name: 'Was trägst du heute mit dir?' }).click()
  const feel = page.getByRole('radiogroup', { name: 'Wie geht es dir dabei?' })
  await feel.hover()
  await expect(feel).toHaveClass(/blob-on/, { timeout: 20_000 })
  await feel.getByRole('radio', { name: 'Gut' }).click()
  await expect(feel.getByRole('radio', { name: 'Gut' })).toHaveAttribute('aria-checked', 'true')
})

test('Zuspruch-Knöpfe: Tropfen füllt und leert, Zustand flackert nicht', async ({ browser }) => {
  const a = await (await browser.newContext()).newPage()
  const b = await (await browser.newContext()).newPage()
  await register(a)
  await register(b)
  const text = `Tropfen-Gedanke ${Date.now()}`
  await share(a, text)
  await b.goto('/lichtung')
  const row = b.locator('article', { hasText: text }).locator('.support')
  const hear = row.getByRole('button', { name: 'Ich höre dich' })
  // Jeden Wechsel von aria-pressed mitschreiben: pro Klick genau einer (früher sprang er kurz zurück).
  await hear.evaluate((el) => {
    const w = window as unknown as { __flips: string[] }
    w.__flips = []
    new MutationObserver(() => w.__flips.push(String(el.getAttribute('aria-pressed')))).observe(el, { attributes: true, attributeFilter: ['aria-pressed'] })
  })
  // Der Tropfen entsteht erst bei Annäherung – vorher die gleich aussehende CSS-Pille.
  await row.hover()
  await expect(row).toHaveClass(/blob-on/, { timeout: 20_000 })
  await hear.click()
  await expect(hear).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(() => b.evaluate(() => (window as unknown as { __flips: string[] }).__flips.join(','))).toBe('true')
  await hear.click()
  await expect(hear).toHaveAttribute('aria-pressed', 'false')
  await expect.poll(() => b.evaluate(() => (window as unknown as { __flips: string[] }).__flips.join(','))).toBe('true,false')
})

test('Melden: «Sorge» und frische Konten blenden nichts aus, drei ältere Konten mit «verletzend» schon', async ({ browser }) => {
  test.slow()
  const pages = await Promise.all([0, 1, 2, 3].map(async () => (await browser.newContext()).newPage()))
  const [author, ...reporters] = pages as [Page, Page, Page, Page]
  await register(author)
  const names = []
  for (const r of reporters) names.push((await register(r)).username)
  const t = Date.now()
  const worried = `Ich kann nicht mehr schlafen ${t}`
  const hurtful = `Ein zweiter Gedanke ${t}`
  const third = `Ein dritter Gedanke ${t}`
  await share(author, worried)
  await share(author, hurtful)
  await share(author, third)

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const status = async (body: string) => (await pool.query(`SELECT status FROM posts WHERE body = $1`, [body])).rows[0]?.status
  async function report(page: Page, text: string, reason: string) {
    await page.goto('/lichtung')
    const card = page.locator('article', { hasText: text })
    await card.getByRole('button', { name: 'Weitere Aktionen' }).click()
    await page.getByRole('menuitem', { name: 'Melden' }).click()
    await page.getByLabel(reason).check()
    await page.getByRole('dialog').getByRole('button', { name: 'Melden' }).click()
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Melden' })).toHaveCount(0)
  }
  try {
    // Frische Konten: Auch drei «verletzend»-Meldungen blenden nichts aus.
    for (const r of reporters) await report(r, hurtful, 'Abwertend oder verletzend')
    expect(await status(hurtful)).toBe('visible')

    // Ältere Konten (Konto älter als drei Tage) – Sorge blendet trotzdem nicht aus …
    await pool.query(`UPDATE users SET created_at = now() - interval '5 days' WHERE username = ANY($1)`, [names])
    for (const r of reporters) await report(r, worried, 'Ich mache mir Sorgen um diese Person')
    expect(await status(worried)).toBe('visible')
    // … drei ältere Konten mit «verletzend» blenden bis zur Prüfung aus.
    for (const r of reporters) await report(r, third, 'Abwertend oder verletzend')
    expect(await status(third)).toBe('hidden')
  } finally {
    await pool.end()
  }
})

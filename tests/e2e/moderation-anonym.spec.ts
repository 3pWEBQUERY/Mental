import { expect, test } from '@playwright/test'
import { Pool } from 'pg'
import { moderator, PASSWORD, register, share } from './helpers'

async function sql<T = Record<string, unknown>>(text: string, params: unknown[] = []) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  try {
    return (await pool.query(text, params)).rows as T[]
  } finally {
    await pool.end()
  }
}
const one = async <T>(text: string, params: unknown[] = []) => (await sql<T>(text, params))[0]!

test('«Anonym» erscheint in der Sprache der Lesenden und verrät nicht die der Verfasserin', async ({ browser }) => {
  const a = await (await browser.newContext()).newPage()
  await register(a)
  const text = `Ganz anonymer Gedanke ${Date.now()}`
  await share(a, text, { anonymous: true })
  await expect(a.locator('article', { hasText: text })).toBeVisible()
  expect((await one<{ h: string }>(`SELECT author_handle AS h FROM posts WHERE body = $1`, [text])).h).toBe('Anonym')
  const ctx = await browser.newContext()
  const b = await ctx.newPage()
  await register(b)
  await ctx.addCookies([{ name: 'lichtung_lang', value: 'it', url: b.url() }])
  await b.goto('/start')
  await expect(b.locator('article', { hasText: text })).toContainText('Anonimo')
})

test('Inhaltshinweis der Moderation bleibt beim Bearbeiten', async ({ page }) => {
  const { username } = await register(page)
  const text = `Gedanke mit Hinweis der Moderation ${Date.now()}`
  await share(page, text)
  await expect(page.locator('article', { hasText: text })).toBeVisible()
  const post = await one<{ id: string; user_id: string }>(`SELECT p.id, p.user_id FROM posts p JOIN users u ON u.id = p.user_id WHERE u.username = $1`, [username])
  await sql(`INSERT INTO moderation_actions (id, moderator_id, target_type, target_id, action) VALUES (gen_random_uuid(), $1, 'post', $2, 'cw')`, [post.user_id, post.id])
  await sql(`UPDATE posts SET content_warning = true WHERE id = $1`, [post.id])
  await page.reload()
  const card = page.locator('article', { hasText: text })
  await card.getByRole('button', { name: 'Weitere Aktionen' }).click()
  await page.getByRole('menuitem', { name: 'Bearbeiten' }).click()
  const cw = page.getByRole('dialog').getByRole('checkbox', { name: /Kann belastend sein/ })
  if (await cw.isChecked()) await page.getByRole('dialog').locator('label.switch', { hasText: 'Kann belastend sein' }).click()
  await page.locator('#composer-text').fill(`${text} (bearbeitet)`)
  await page.getByRole('button', { name: 'Aktualisieren' }).click()
  await expect(page.locator('#composer-text')).toHaveCount(0)
  expect((await one<{ cw: boolean }>(`SELECT content_warning AS cw FROM posts WHERE id = $1`, [post.id])).cw).toBe(true)
})

test('Freigegebene Antwort benachrichtigt die Person, die den Gedanken geteilt hat', async ({ browser }) => {
  const a = await (await browser.newContext()).newPage()
  const { username } = await register(a)
  const text = `Gedanke, dessen Antwort zurückgehalten wird ${Date.now()}`
  await share(a, text)
  const b = await (await browser.newContext()).newPage()
  await register(b)
  await b.goto('/start')
  const card = b.locator('article', { hasText: text })
  await card.locator('.reply-toggle').click()
  const reply = `Eine Antwort zur Prüfung ${Date.now()}`
  await card.getByLabel('Antwort schreiben').fill(reply)
  await card.getByRole('button', { name: 'Antwort senden' }).click()
  await expect(card.getByText(reply)).toBeVisible()
  // Die Antwort erscheint sofort (optimistisch) – gespeichert ist sie erst einen Moment später.
  await expect.poll(async () => (await one<{ n: number }>(`SELECT count(*)::int AS n FROM replies WHERE body = $1`, [reply])).n).toBe(1)
  const r = await one<{ id: string; post_id: string }>(`SELECT id, post_id FROM replies WHERE body = $1`, [reply])
  await sql(`UPDATE replies SET status = 'pending' WHERE id = $1`, [r.id])
  await sql(`DELETE FROM notifications WHERE post_id = $1`, [r.post_id])
  await sql(`INSERT INTO reports (id, target_type, target_id, reason, priority) VALUES (gen_random_uuid(), 'reply', $1, 'auto_flag', 2)`, [r.id])
  const mod = await moderator(browser)
  await mod.goto('/admin')
  const item = mod.locator('.queue-item', { hasText: reply })
  await item.getByRole('button', { name: 'Freigeben' }).click()
  await expect(item).toHaveCount(0)
  await expect
    .poll(async () => (await one<{ n: number }>(`SELECT count(*)::int AS n FROM notifications n JOIN users u ON u.id = n.user_id WHERE u.username = $1 AND n.kind = 'reply' AND n.post_id = $2`, [username, r.post_id])).n)
    .toBe(1)
})

test('«Gutgetan» zeigt keine Antworten, die die Moderation ausgeblendet hat', async ({ browser }) => {
  const a = await (await browser.newContext()).newPage()
  await register(a)
  const text = `Gedanke für Gutgetan ${Date.now()}`
  await share(a, text)
  const b = await (await browser.newContext()).newPage()
  await register(b)
  await b.goto('/start')
  const card = b.locator('article', { hasText: text })
  await card.locator('.reply-toggle').click()
  const reply = `Das hat gutgetan ${Date.now()}`
  await card.getByLabel('Antwort schreiben').fill(reply)
  await card.getByRole('button', { name: 'Antwort senden' }).click()
  await expect(card.getByText(reply)).toBeVisible()
  // Optimistisch angezeigt – erst warten, bis die Antwort gespeichert ist.
  await expect.poll(async () => (await one<{ n: number }>(`SELECT count(*)::int AS n FROM replies WHERE body = $1`, [reply])).n).toBe(1)
  await sql(`UPDATE replies SET helpful = true WHERE body = $1`, [reply])
  await a.goto('/ich?tab=gutgetan')
  await expect(a.getByText(reply)).toBeVisible()
  await sql(`UPDATE replies SET status = 'hidden' WHERE body = $1`, [reply])
  await a.reload()
  await expect(a.getByRole('heading', { name: 'Antworten, die dir gutgetan haben' })).toBeVisible()
  await expect(a.getByText(reply)).toHaveCount(0)
})

test('Tagebuch: PIN vergessen → mit Passwort löschen und neu beginnen', async ({ page }) => {
  await register(page)
  await page.goto('/ich?tab=tagebuch')
  await page.locator('#pin').fill('geheim123')
  await page.locator('#pin2').fill('geheim123')
  await page.getByRole('button', { name: 'Tagebuch einrichten' }).click()
  await page.locator('#journal-new').fill('Ein privater Eintrag')
  await page.getByRole('button', { name: 'Eintrag speichern' }).click()
  await expect(page.getByText('Ein privater Eintrag')).toBeVisible()
  await page.getByRole('button', { name: 'Sperren' }).click()
  await page.getByText('PIN vergessen?').click()
  await page.getByLabel('Zur Bestätigung: dein Passwort').fill('falsches passwort 123')
  await page.getByRole('button', { name: 'Tagebuch löschen und neu beginnen' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Tagebuch löschen und neu beginnen' }).click()
  await expect(page.getByText('Tagebuch entsperren')).toBeVisible()
  await page.getByLabel('Zur Bestätigung: dein Passwort').fill(PASSWORD)
  await page.getByRole('button', { name: 'Tagebuch löschen und neu beginnen' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Tagebuch löschen und neu beginnen' }).click()
  await expect(page.getByText('Das Tagebuch ist gelöscht. Wähle eine neue PIN.').first()).toBeVisible()
  await expect(page.getByText('Wähle eine Tagebuch-PIN')).toBeVisible()
  await page.reload()
  await expect(page.getByText('Wähle eine Tagebuch-PIN')).toBeVisible()
})

test('Zurückgehaltener Krisen-Gedanke: «Verwerfen» gibt ihn frei – er bleibt nicht für immer «wartet»', async ({ browser }) => {
  const a = await (await browser.newContext()).newPage()
  await register(a)
  const text = `Ein Gedanke zum Zurückhalten ${Date.now()}`
  await share(a, text)
  await expect.poll(async () => (await sql<{ n: number }>(`SELECT count(*)::int AS n FROM posts WHERE body = $1`, [text]))[0]!.n).toBe(1)
  const p = await one<{ id: string }>(`SELECT id FROM posts WHERE body = $1`, [text])
  await sql(`UPDATE posts SET status = 'pending', crisis_level = 'acute' WHERE id = $1`, [p.id])
  await sql(`INSERT INTO reports (id, target_type, target_id, reason, priority) VALUES (gen_random_uuid(), 'post', $1, 'auto_acute', 0)`, [p.id])
  const mod = await moderator(browser)
  await mod.goto('/admin')
  const item = mod.locator('.queue-item', { hasText: text })
  await item.getByRole('button', { name: 'Verwerfen' }).click()
  await expect(item).toHaveCount(0)
  await expect.poll(async () => (await one<{ status: string }>(`SELECT status FROM posts WHERE id = $1`, [p.id])).status).toBe('visible')
  expect((await one<{ n: number }>(`SELECT count(*)::int AS n FROM reports WHERE target_id = $1 AND status = 'open'`, [p.id])).n).toBe(0)
})

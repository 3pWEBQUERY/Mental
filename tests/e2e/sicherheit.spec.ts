import { execSync } from 'node:child_process'
import { expect, test } from '@playwright/test'
import { Pool } from 'pg'
import { login, moderator, openComposer, PASSWORD, register } from './helpers'

async function sql<T = Record<string, unknown>>(text: string, params: unknown[] = []) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  try {
    return (await pool.query(text, params)).rows as T[]
  } finally {
    await pool.end()
  }
}

test('/sprache leitet nie auf fremde Seiten weiter', async ({ request }) => {
  for (const back of ['/\\evil.example', '/\t/evil.example', '//evil.example', 'https://evil.example/', '/%5Cevil.example']) {
    const res = await request.get(`/sprache?l=de&zurueck=${encodeURIComponent(back)}`, { maxRedirects: 0 })
    expect(res.status(), back).toBeGreaterThanOrEqual(300)
    const location = new URL(res.headers().location!, 'http://x')
    expect(location.hostname, back).not.toContain('evil')
  }
  const ok = await request.get(`/sprache?l=de&zurueck=${encodeURIComponent('/einstellungen?x=1')}`, { maxRedirects: 0 })
  expect(ok.headers().location).toMatch(/\/einstellungen\?x=1$/)
})

test('Moderationskonto: Passkey entfernen nur aus einer Passkey-Sitzung', async ({ browser }) => {
  const mod = await moderator(browser)
  const username = (await sql<{ username: string }>(`SELECT username FROM users WHERE role = 'mod' ORDER BY created_at DESC LIMIT 1`))[0]!.username
  // Gleiches Konto, aber mit dem Passwort angemeldet: Entfernen geht nicht.
  const pw = await (await browser.newContext()).newPage()
  await login(pw, username)
  await pw.waitForURL('**/start')
  await pw.goto('/einstellungen')
  await pw.getByRole('button', { name: 'Entfernen' }).first().click()
  await pw.getByRole('dialog').getByRole('button', { name: 'Entfernen' }).click()
  await expect(pw.getByText('Passkeys an einem Moderationskonto entfernst du nur')).toBeVisible()
  expect((await sql<{ n: number }>(`SELECT count(*)::int AS n FROM passkeys p JOIN users u ON u.id = p.user_id WHERE u.username = $1`, [username]))[0]!.n).toBe(1)
  // Mit dem Passkey angemeldet: geht, und die Glocke meldet es.
  await mod.goto('/einstellungen')
  await mod.getByRole('button', { name: 'Entfernen' }).first().click()
  await mod.getByRole('dialog').getByRole('button', { name: 'Entfernen' }).click()
  await expect.poll(async () => (await sql<{ n: number }>(`SELECT count(*)::int AS n FROM passkeys p JOIN users u ON u.id = p.user_id WHERE u.username = $1`, [username]))[0]!.n).toBe(0)
  await expect
    .poll(async () => (await sql<{ n: number }>(`SELECT count(*)::int AS n FROM notifications n JOIN users u ON u.id = n.user_id WHERE u.username = $1 AND n.payload::text LIKE '%Passkey entfernt%'`, [username]))[0]!.n)
    .toBe(1)
})

test('Moderationskonto nach der Wiederherstellung: 72 Stunden kein neuer Passkey', async ({ page, context }) => {
  const cdp = await context.newCDPSession(page)
  await cdp.send('WebAuthn.enable')
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true },
  })
  const { username, words } = await register(page)
  execSync(`npm run admin:grant -- ${username} mod`, { stdio: 'ignore' })
  await page.goto('/wiederherstellen')
  await page.getByLabel('Benutzername').fill(username)
  await page.getByLabel('Wiederherstellungsschlüssel').fill(words.join(' '))
  await page.getByLabel('Neues Passwort').fill(`${PASSWORD} neu`)
  await page.getByRole('button', { name: 'Weiter' }).click()
  await expect(page.getByRole('heading', { name: 'Dein neuer Schlüssel' })).toBeVisible()
  await page.goto('/einstellungen')
  await page.getByRole('button', { name: 'Passkey hinzufügen' }).click()
  await expect(page.getByText('erst nach 72 Stunden wieder einen Passkey')).toBeVisible()
  expect((await sql<{ n: number }>(`SELECT count(*)::int AS n FROM passkeys p JOIN users u ON u.id = p.user_id WHERE u.username = $1`, [username]))[0]!.n).toBe(0)
})

test('Stummschaltung bleibt nach «Konto löschen» und erneutem Anmelden bestehen', async ({ page }) => {
  const { username } = await register(page)
  await sql(`UPDATE users SET status = 'muted', muted_until = now() + interval '7 days' WHERE username = $1`, [username])
  await page.goto('/einstellungen')
  await page.getByLabel('Mit Passwort bestätigen').fill(PASSWORD)
  await page.getByRole('button', { name: 'Konto löschen' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Konto löschen' }).click()
  await page.waitForURL((u) => u.pathname === '/')
  await login(page, username)
  await page.waitForURL('**/start')
  const [u] = await sql<{ status: string; delete_after: Date | null }>(`SELECT status, delete_after FROM users WHERE username = $1`, [username])
  expect(u!.status).toBe('muted')
  expect(u!.delete_after).toBeNull()
})

test('Krisenwörter: erneutes Bearbeiten erzeugt keine weiteren Alarme', async ({ page }) => {
  await register(page)
  await openComposer(page)
  const text = `Ich will nicht mehr leben ${Date.now()}`
  await page.locator('#composer-text').fill(text)
  await page.getByRole('button', { name: 'Teilen', exact: true }).click()
  await page.getByRole('button', { name: 'Ich bleibe noch in der App' }).click()
  const [post] = await sql<{ id: string }>(`SELECT id FROM posts ORDER BY created_at DESC LIMIT 1`)
  for (let i = 0; i < 2; i++) {
    const card = page.locator('article', { hasText: 'Ich will nicht mehr leben' }).first()
    await card.getByRole('button', { name: 'Weitere Aktionen' }).click()
    await page.getByRole('menuitem', { name: 'Bearbeiten' }).click()
    await page.locator('#composer-text').fill(`${text} – Bearbeitung ${i + 1}`)
    await page.getByRole('button', { name: 'Aktualisieren' }).click()
    await expect(page.locator('#composer-text')).toHaveCount(0)
    if (await page.getByRole('button', { name: 'Ich bleibe noch in der App' }).isVisible()) await page.getByRole('button', { name: 'Ich bleibe noch in der App' }).click()
  }
  const [{ n }] = (await sql<{ n: number }>(`SELECT count(*)::int AS n FROM reports WHERE target_id = $1 AND reason = 'auto_acute'`, [post!.id])) as [{ n: number }]
  expect(n).toBe(1)
})

test('Admin: Moderationskonten lassen sich nicht direkt sperren', async ({ browser }) => {
  const admin = await moderator(browser, 'admin')
  // Ein Mod-Konto teilt einen Gedanken, der in der Warteschlange landet.
  const page = await browser.newPage()
  const { username } = await register(page)
  execSync(`npm run admin:grant -- ${username} mod`, { stdio: 'ignore' })
  await openComposer(page)
  const text = `Gedanke eines Mod-Kontos ${Date.now()}`
  await page.locator('#composer-text').fill(text)
  await page.getByRole('button', { name: 'Teilen', exact: true }).click()
  await expect(page.locator('article', { hasText: text })).toBeVisible()
  const [post] = await sql<{ id: string }>(`SELECT p.id FROM posts p JOIN users u ON u.id = p.user_id WHERE u.username = $1`, [username])
  await sql(`INSERT INTO reports (target_type, target_id, reason, priority) VALUES ('post', $1, 'auto_flag', 2)`, [post!.id])
  await admin.goto('/admin')
  const item = admin.locator('.queue-item', { hasText: text })
  await expect(item).toBeVisible()
  await expect(item.getByText('erst nach dem Herabstufen unter «Rollen»')).toBeVisible()
  await expect(item.getByRole('button', { name: /Sperren/ })).toHaveCount(0)
})

test('Antwort bleibt bei Netzabbruch erhalten', async ({ browser }) => {
  const a = await browser.newPage()
  await register(a)
  await openComposer(a)
  const text = `Gedanke für die Netz-Probe ${Date.now()}`
  await a.locator('#composer-text').fill(text)
  await a.getByRole('button', { name: 'Teilen', exact: true }).click()
  const b = await browser.newPage()
  await register(b)
  await b.goto('/start')
  const card = b.locator('article', { hasText: text })
  await expect(card).toBeVisible()
  const reply = 'Eine lange, liebevolle Antwort, die nicht verloren gehen darf.'
  await card.getByLabel('Antwort schreiben').fill(reply)
  await b.context().setOffline(true)
  await card.getByRole('button', { name: 'Antwort senden' }).click()
  await expect(b.getByText('Das hat gerade nicht geklappt').first()).toBeVisible()
  await expect(card.getByLabel('Antwort schreiben')).toHaveValue(reply)
  await expect(b.locator('.help-page h1')).toHaveCount(0)
  await b.context().setOffline(false)
})

test('Krisenhinweis auf Französisch nennt La Main Tendue', async ({ page, context }) => {
  await register(page)
  await context.addCookies([{ name: 'lichtung_lang', value: 'fr', url: page.url() }])
  await page.goto('/start')
  await openComposer(page, 'Qu’est-ce que tu portes avec toi aujourd’hui ?')
  await page.locator('#composer-text').fill("Je n'en peux plus, j'ai envie de mourir")
  const care = page.getByRole('dialog').locator('.care')
  await expect(care).toContainText('La Main Tendue')
  await expect(care).not.toContainText('Dargebotene')
})

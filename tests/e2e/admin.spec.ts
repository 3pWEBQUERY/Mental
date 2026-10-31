import { execSync } from 'node:child_process'
import { expect, test } from '@playwright/test'
import { Pool } from 'pg'
import { register, share } from './helpers'

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

test('Moderationskonto: weiterer Passkey nur aus einer Passkey-Sitzung – das Passwort genügt nicht', async ({ page, context }) => {
  // Virtueller Authenticator (Chromium): Passkeys ohne echtes Gerät.
  const cdp = await context.newCDPSession(page)
  await cdp.send('WebAuthn.enable')
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true },
  })
  const { username } = await register(page)

  // Normales Konto, frische Sitzung: Passkey anlegen geht.
  await page.goto('/einstellungen')
  await page.getByRole('button', { name: 'Passkey hinzufügen' }).click()
  await expect(page.getByText('Passkey eingerichtet.')).toBeVisible()

  // Wird das Konto zum Moderationskonto, reicht die Passwort-Sitzung für einen weiteren Passkey nicht mehr.
  execSync(`npm run admin:grant -- ${username} mod`, { stdio: 'ignore' })
  await page.reload()
  await page.getByRole('button', { name: 'Passkey hinzufügen' }).click()
  await expect(page.getByText(/nur an, wenn du mit einem Passkey angemeldet bist/)).toBeVisible()
})

test('Domainwechsel: Passkeys der alten Domain sperren ein Moderationskonto nicht aus', async ({ page, context }) => {
  const cdp = await context.newCDPSession(page)
  await cdp.send('WebAuthn.enable')
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true },
  })
  const { username } = await register(page)
  await page.goto('/einstellungen')
  await page.getByRole('button', { name: 'Passkey hinzufügen' }).click()
  await expect(page.getByText('Passkey eingerichtet.')).toBeVisible()
  execSync(`npm run admin:grant -- ${username} mod`, { stdio: 'ignore' })
  // Der vorhandene Passkey gehört zu einer anderen (alten) Domain – hier funktioniert er nicht mehr.
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  try {
    await pool.query(`UPDATE passkeys SET rp_id = 'alte-adresse.up.railway.app' WHERE user_id = (SELECT id FROM users WHERE username = $1)`, [username])
  } finally {
    await pool.end()
  }
  // Wie nach einem echten Wechsel: Für die neue Domain hat das Gerät noch keinen Passkey.
  await cdp.send('WebAuthn.clearCredentials', { authenticatorId })
  await page.reload()
  await page.getByRole('button', { name: 'Passkey hinzufügen' }).click()
  await expect(page.getByText('Passkey eingerichtet.')).toBeVisible()
})

/** Moderationskonto mit echter Passkey-Sitzung (virtueller Authenticator) – nur so öffnet sich /admin. */
async function moderator(browser: import('@playwright/test').Browser, role: 'mod' | 'admin' = 'mod') {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  const cdp = await ctx.newCDPSession(page)
  await cdp.send('WebAuthn.enable')
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true },
  })
  const { username } = await register(page)
  await page.goto('/einstellungen')
  await page.getByRole('button', { name: 'Passkey hinzufügen' }).click()
  await expect(page.getByText('Passkey eingerichtet.')).toBeVisible()
  execSync(`npm run admin:grant -- ${username} ${role}`, { stdio: 'ignore' })
  await page.getByRole('button', { name: 'Abmelden', exact: true }).click()
  await page.waitForURL('**/anmelden')
  await page.getByRole('button', { name: 'Mit Passkey anmelden' }).click()
  await page.waitForURL('**/start')
  return page
}

test('Moderation: Krisen-Alarm, weichgezeichnet, Übernahme, Fürsorge, Einspruch, Kontoseite, Statistik', async ({ browser }) => {
  test.slow()
  const mod = await moderator(browser)
  const user = await (await browser.newContext()).newPage()
  await register(user)

  // Akuter Treffer → Alarm in der Glocke der Moderation.
  const crisis = `Ich will nicht mehr leben ${Date.now()}`
  await user.getByRole('button', { name: 'Was trägst du heute mit dir?' }).click()
  await user.locator('#composer-text').fill(crisis)
  await user.getByRole('button', { name: 'Teilen', exact: true }).click()
  await user.getByRole('button', { name: 'Ich bleibe noch in der App' }).click()
  await mod.reload()
  await mod.getByRole('button', { name: /Benachrichtigungen/ }).click()
  await expect(mod.getByRole('dialog')).toContainText('akuter Krisen-Hinweis')
  await mod.keyboard.press('Escape')

  // Warteschlange: weichgezeichnet bis zum Aufdecken, Fall übernehmen, «Gesehen · Fürsorge senden».
  await mod.goto('/admin')
  const item = mod.locator('.queue-item', { hasText: crisis })
  await expect(item.locator('.sensitive-veil')).toContainText(crisis)
  await item.getByRole('button', { name: /Belastender Inhalt/ }).click()
  await expect(item.locator('blockquote')).toContainText(crisis)
  await item.getByRole('button', { name: 'Übernehmen' }).click()
  await expect(mod.getByText('Von dir übernommen').first()).toBeVisible()
  await mod.locator('.queue-item', { hasText: crisis }).getByRole('button', { name: 'Gesehen · Fürsorge senden' }).click()
  await expect(mod.locator('.queue-item', { hasText: crisis })).toHaveCount(0)

  await user.reload()
  await user.getByRole('button', { name: /Benachrichtigungen/ }).click()
  await expect(user.getByRole('dialog')).toContainText('denkt an dich')
  await expect(user.getByRole('dialog')).toContainText('143')
  await user.keyboard.press('Escape')

  // Stummschalten → die Person erhebt Einspruch → Moderation sieht ihn, hebt auf der Kontoseite auf, nimmt an.
  const other = `Ein ganz gewöhnlicher Gedanke ${Date.now()}`
  await share(user, other)
  await expect(user.locator('article', { hasText: other })).toBeVisible()
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  try {
    const { rows } = await pool.query(`SELECT id FROM posts WHERE body = $1`, [other])
    await pool.query(`INSERT INTO reports (id, target_type, target_id, reason, priority, reporter_id) VALUES (gen_random_uuid(), 'post', $1, 'hurtful', 2, NULL)`, [rows[0].id])
  } finally {
    await pool.end()
  }
  await mod.goto('/admin')
  await mod.locator('.queue-item', { hasText: other }).getByRole('button', { name: '24 h stumm' }).click()
  await expect(mod.locator('.queue-item', { hasText: other })).toHaveCount(0)

  await user.reload()
  await user.getByRole('button', { name: /Benachrichtigungen/ }).click()
  const dlg = user.getByRole('dialog')
  await dlg.getByRole('button', { name: 'Einspruch erheben' }).first().click()
  await dlg.getByLabel('Was sollte die Moderation wissen?').fill('Das war nicht abwertend gemeint, nur ehrlich.')
  await dlg.getByRole('button', { name: 'Einspruch senden' }).click()
  await expect(dlg.getByText('Dein Einspruch liegt bei der Moderation')).toBeVisible()
  await user.keyboard.press('Escape')

  await mod.goto('/admin')
  const appeal = mod.locator('.queue-item', { hasText: 'nicht abwertend gemeint' })
  await expect(appeal).toBeVisible()
  await appeal.getByRole('link', { name: /Mitglied/ }).click()
  await expect(mod.getByRole('heading', { name: /Mitglied/ })).toBeVisible()
  await expect(mod.locator('.facts')).toContainText('stumm')
  await expect(mod.locator('table')).toContainText('mute24')
  await mod.getByRole('button', { name: 'Stummschaltung aufheben' }).click()
  await expect(mod.locator('.facts')).toContainText('aktiv')
  await mod.goto('/admin')
  await mod.locator('.queue-item', { hasText: 'nicht abwertend gemeint' }).getByRole('button', { name: 'Annehmen' }).click()
  await expect(mod.locator('.queue-item', { hasText: 'nicht abwertend gemeint' })).toHaveCount(0)

  await user.reload()
  await user.getByRole('button', { name: /Benachrichtigungen/ }).click()
  await expect(user.getByRole('dialog')).toContainText('Einspruch wurde angenommen')
  await expect(user.getByRole('dialog')).toContainText('wieder schreiben')

  // Statistik lädt (nur Zahlen).
  await mod.goto('/admin/statistik')
  await expect(mod.getByRole('heading', { name: 'Statistik' })).toBeVisible()
})

test('Anzeigename: keine Telefonnummer, kein vorgetäuschtes Team', async ({ page }) => {
  await register(page)
  await page.goto('/einstellungen')
  const name = page.getByLabel('Anzeigename')
  await name.fill('Mira 079 123 45 67')
  await page.getByRole('button', { name: 'Speichern' }).first().click()
  await expect(page.getByText(/keine Telefonnummer, E-Mail/)).toBeVisible()
  await name.fill('Jiaia Team')
  await page.getByRole('button', { name: 'Speichern' }).first().click()
  await expect(page.getByText(/für das Team reserviert/)).toBeVisible()
})

test('Rollen: Vier-Augen-Prinzip – vorschlagen, nicht selbst bestätigen, zweiter Admin bestätigt', async ({ browser }) => {
  test.slow()
  const first = await moderator(browser, 'admin')
  const second = await moderator(browser, 'admin')
  const user = await (await browser.newContext()).newPage()
  await register(user)
  const body = `Rollen-Test ${Date.now()}`
  await share(user, body)
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  try {
    const { rows } = await pool.query(`SELECT id FROM posts WHERE body = $1`, [body])
    await pool.query(`INSERT INTO reports (id, target_type, target_id, reason, priority, reporter_id) VALUES (gen_random_uuid(), 'post', $1, 'other', 2, NULL)`, [rows[0].id])
  } finally {
    await pool.end()
  }

  // Erster Admin schlägt «Moderation» vor – die Rolle gilt noch nicht, Bestätigen kann er nicht selbst.
  await first.goto('/admin')
  await first.locator('.queue-item', { hasText: body }).getByRole('link', { name: /Mitglied/ }).click()
  await expect(first.getByRole('heading', { name: 'Rolle ändern' })).toBeVisible()
  await first.getByLabel('Neue Rolle').selectOption('mod')
  await first.getByLabel('Begründung (für das Audit-Log)').fill('Hilft seit Wochen verlässlich')
  await first.getByRole('button', { name: 'Vorschlagen' }).click()
  await expect(first.getByText(/Vorgeschlagen: Moderation/)).toBeVisible()
  await expect(first.getByRole('button', { name: 'Bestätigen' })).toHaveCount(0)
  await expect(first.getByRole('button', { name: 'Zurückziehen' })).toBeVisible()
  await expect(first.locator('.facts')).toContainText('Mitglied')
  await expect(first.locator('table')).toContainText('role_propose')

  // Zweiter Admin: Glocke, offene Vorschläge in der Warteschlange, bestätigen.
  await second.reload()
  await second.getByRole('button', { name: /Benachrichtigungen/ }).click()
  await expect(second.getByRole('dialog')).toContainText('Rollenwechsel wurde vorgeschlagen')
  await second.keyboard.press('Escape')
  await second.goto('/admin')
  const open = second.getByRole('region', { name: 'Offene Rollen-Vorschläge' })
  await expect(open).toContainText('Moderation')
  await open.getByRole('link', { name: /Mitglied/ }).click()
  await second.getByRole('button', { name: 'Bestätigen' }).click()
  await expect(second.locator('.facts')).toContainText('Moderation')
  await expect(second.locator('table')).toContainText('role_accept')
  await expect(second.getByRole('button', { name: 'Vorschlagen' })).toBeVisible()

  await user.reload()
  await user.getByRole('button', { name: /Benachrichtigungen/ }).click()
  await expect(user.getByRole('dialog')).toContainText('Deine Rolle in Jiaia ist jetzt: Moderation')
})

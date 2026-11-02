import { expect, test } from '@playwright/test'
import { Pool } from 'pg'
import { moderator, register, share } from './helpers'

async function sql<T = Record<string, unknown>>(text: string, params: unknown[] = []) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  try {
    return (await pool.query(text, params)).rows as T[]
  } finally {
    await pool.end()
  }
}

test('Admin: Mitglieder auflisten, suchen, stummschalten, sperren, überall abmelden', async ({ browser }) => {
  test.slow()
  const admin = await moderator(browser, 'admin')
  const member = await (await browser.newContext()).newPage()
  const { username } = await register(member)
  await share(member, `Gedanke eines Mitglieds ${Date.now()}`)
  const status = async () => (await sql<{ status: string }>(`SELECT status FROM users WHERE username = $1`, [username]))[0]!.status

  // Liste: neuestes Konto zuerst, nie mit Benutzernamen.
  await admin.goto('/admin/mitglieder')
  await expect(admin.getByRole('heading', { name: 'Mitglieder' })).toBeVisible()
  await expect(admin.locator('main')).not.toContainText(username)
  const first = admin.locator('table tbody tr').first()
  await expect(first).toContainText('aktiv')
  const ref = (await first.locator('a.member-link').textContent())!.trim()
  expect(ref).toMatch(/^M-[0-9A-F]{8}$/)

  // Suche nach der Mitglieds-ID findet genau dieses Konto.
  await admin.getByRole('textbox', { name: /Mitglieds-ID/ }).fill(ref.toLowerCase())
  await admin.getByRole('button', { name: 'Suchen' }).click()
  await expect(admin.locator('table tbody tr')).toHaveCount(1)
  await admin.locator('table tbody tr a.member-link').click()
  await expect(admin.getByRole('heading', { name: `Mitglied ${ref}` })).toBeVisible()

  // 24 Stunden stumm – mit Begründung, die Person bekommt eine Nachricht.
  await admin.getByRole('form', { name: 'Massnahme am Konto' }).getByLabel(/Begründung/).fill('Bitte freundlich bleiben.')
  await admin.getByRole('button', { name: '24 h stumm' }).click()
  await expect(admin.getByText('Massnahme ausgeführt.')).toBeVisible()
  expect(await status()).toBe('muted')
  await expect
    .poll(async () => (await sql<{ n: number }>(`SELECT count(*)::int AS n FROM notifications n JOIN users u ON u.id = n.user_id WHERE u.username = $1 AND n.kind = 'moderation'`, [username]))[0]!.n)
    .toBe(1)

  // Überall abmelden.
  await admin.getByRole('button', { name: 'Überall abmelden' }).click()
  await expect(admin.getByText('Alle Sitzungen dieses Kontos sind beendet.')).toBeVisible()
  await member.goto('/ich')
  await expect(member).toHaveURL(/\/anmelden$/)

  // Filter «stumm» zeigt das Konto.
  await admin.goto('/admin/mitglieder?status=muted')
  await expect(admin.locator('table')).toContainText(ref)

  // Sperren – mit Rückfrage; «Abbrechen» ändert nichts.
  await admin.locator('a.member-link', { hasText: ref }).click()
  await admin.getByRole('button', { name: 'Sperren' }).click()
  await admin.getByRole('dialog').getByRole('button', { name: 'Abbrechen' }).click()
  expect(await status()).toBe('muted')
  await admin.getByRole('button', { name: 'Sperren' }).click()
  await admin.getByRole('dialog').getByRole('button', { name: 'Sperren' }).click()
  await expect(admin.getByText('Massnahme ausgeführt.')).toBeVisible()
  expect(await status()).toBe('banned')
  await expect(admin.getByRole('button', { name: 'Sperre aufheben' })).toBeVisible()
})

test('Admin: das eigene Konto lässt sich nicht sperren', async ({ browser }) => {
  const admin = await moderator(browser, 'admin')
  await admin.goto('/admin/mitglieder?status=staff')
  // Das eigene Konto ist das neueste Moderationskonto.
  await admin.locator('table tbody tr a.member-link').first().click()
  await expect(admin.getByText('Das ist dein eigenes Konto.')).toBeVisible()
  await expect(admin.getByRole('button', { name: 'Sperren' })).toHaveCount(0)
})

test('Admin: über eine Herabstufung des eigenen Kontos entscheiden die anderen; Moderationskonten nur verwarnen', async ({ browser }) => {
  test.slow()
  const first = await moderator(browser, 'admin')
  const second = await moderator(browser, 'admin')
  // Der erste Admin schlägt vor, den zweiten (das neueste Moderationskonto) herabzustufen.
  await first.goto('/admin/mitglieder?status=staff')
  await first.locator('table tbody tr a.member-link').first().click()
  const form = first.getByRole('form', { name: 'Massnahme am Konto' })
  await expect(form.getByRole('button', { name: 'Verwarnen' })).toBeVisible()
  await expect(form.getByRole('button', { name: /stumm|Sperren|Überall abmelden/ })).toHaveCount(0)
  await first.getByLabel('Neue Rolle').selectOption('member')
  await first.getByLabel('Begründung (für das Audit-Log)').fill('Konto möglicherweise übernommen')
  await first.getByRole('button', { name: 'Vorschlagen' }).click()
  await expect(first.getByText(/Vorgeschlagen: Mitglied/)).toBeVisible()
  // Der zweite Admin sieht den Vorschlag zum eigenen Konto, kann ihn aber weder ablehnen noch bestätigen.
  await second.goto('/admin/mitglieder?status=staff')
  await second.locator('table tbody tr a.member-link').first().click()
  await expect(second.getByText('Ein Vorschlag zu deinem eigenen Konto')).toBeVisible()
  await expect(second.getByRole('button', { name: /Verwerfen|Bestätigen/ })).toHaveCount(0)
})

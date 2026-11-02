import { expect, test, type APIRequestContext } from '@playwright/test'
import { Pool } from 'pg'
import { moderator, openComposer, register, share } from './helpers'

/** Der zweite Server (playwright.config.ts) steht für die zweite Web-Replika: Änderungen müssen dort sofort gelten. */
const OTHER = `http://localhost:${Number(process.env.E2E_PORT ?? 3100) + 1}`

async function html(request: APIRequestContext, url: string) {
  const res = await request.get(url)
  expect(res.ok(), url).toBe(true)
  return res.text()
}

/** Seite einmal laden, bis der Text da ist bzw. weg ist – höchstens ein paar Sekunden (NOTIFY zwischen den Servern). */
async function shows(request: APIRequestContext, url: string, text: string, present = true) {
  await expect.poll(async () => (await html(request, url)).includes(text), { timeout: 8_000, message: `${url} ${present ? 'zeigt' : 'zeigt nicht mehr'} «${text}»` }).toBe(present)
}

test('Admin: Kreise anlegen, bearbeiten, löschen – sofort in der App und auf dem zweiten Server', async ({ browser, request }) => {
  test.slow()
  const admin = await moderator(browser, 'admin')
  const slug = `test-${Date.now().toString(36)}`
  const name = `Testkreis ${slug.slice(5)}`
  // Beide Server haben /regeln (Kreisliste) im Cache.
  await html(request, '/regeln')
  await html(request, `${OTHER}/regeln`)

  await admin.goto('/admin/kreise')
  const neu = admin.getByRole('form', { name: 'Neuer Kreis' })
  await neu.getByLabel('Name', { exact: true }).fill(name)
  await neu.getByLabel('Kurzname (Adresse)').fill(slug)
  await neu.getByLabel('Beschreibung', { exact: true }).fill('Ein Kreis nur für den Test.')
  await neu.getByLabel('Hausregeln', { exact: true }).fill('Freundlich bleiben.')
  await neu.getByRole('button', { name: 'Kreis anlegen' }).click()
  await expect(admin.getByText(`Kreis «${name}» angelegt.`)).toBeVisible()
  // Formular für neue Kreise ist wieder leer, der Kreis steht in der Liste.
  await expect(neu.getByLabel('Name', { exact: true })).toHaveValue('')
  const card = admin.getByRole('form', { name: `Kreis ${name}`, exact: true })
  await expect(card).toBeVisible()
  await shows(request, '/regeln', name)
  await shows(request, `${OTHER}/regeln`, name)
  // Im Gedanken-Fenster der App wählbar.
  await admin.goto('/start')
  await openComposer(admin)
  await expect(admin.getByRole('dialog').getByText(name, { exact: true })).toBeVisible()
  await admin.keyboard.press('Escape')

  // Doppelter Kurzname: Fehler am Formular, Eingaben bleiben.
  await admin.goto('/admin/kreise')
  await neu.getByLabel('Name', { exact: true }).fill('Zweiter')
  await neu.getByLabel('Kurzname (Adresse)').fill(slug)
  await neu.getByLabel('Beschreibung', { exact: true }).fill('x')
  await neu.getByLabel('Hausregeln', { exact: true }).fill('x')
  await neu.getByRole('button', { name: 'Kreis anlegen' }).click()
  await expect(neu.getByRole('alert')).toContainText(`«${slug}» hat schon ein anderer Kreis`)
  await expect(neu.getByLabel('Name', { exact: true })).toHaveValue('Zweiter')

  // Bearbeiten.
  const renamed = `${name} neu`
  await card.getByLabel('Name', { exact: true }).fill(renamed)
  await card.getByRole('button', { name: 'Speichern' }).click()
  await expect(admin.getByText(`Kreis «${renamed}» gespeichert.`)).toBeVisible()
  await shows(request, `${OTHER}/regeln`, renamed)

  // Löschen mit einem Gedanken darin: Er wandert in den gewählten Kreis.
  const user = await browser.newPage()
  await register(user)
  const text = `Gedanke im Testkreis ${slug}`
  await share(user, text)
  await expect(user.locator('article', { hasText: text })).toBeVisible()
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  try {
    await pool.query(`UPDATE posts SET circle_id = (SELECT id FROM circles WHERE slug = $1) WHERE id = (SELECT id FROM posts ORDER BY created_at DESC LIMIT 1)`, [slug])
    await admin.reload()
    const edited = admin.getByRole('form', { name: `Kreis ${renamed}`, exact: true })
    await expect(admin.getByLabel('Gedanken verschieben nach').last()).toBeAttached()
    await edited.getByRole('button', { name: 'Löschen' }).click()
    await admin.getByRole('dialog').getByRole('button', { name: 'Löschen' }).click()
    await expect(admin.getByText(`Kreis «${renamed}» gelöscht, 1 Gedanken verschoben.`)).toBeVisible()
    await expect(edited).toHaveCount(0)
    const { rows } = await pool.query(`SELECT count(*)::int AS n FROM circles WHERE slug = $1`, [slug])
    expect(rows[0].n).toBe(0)
    const moved = await pool.query(`SELECT c.slug FROM posts p JOIN circles c ON c.id = p.circle_id ORDER BY p.created_at DESC LIMIT 1`)
    expect(moved.rows[0].slug).not.toBe(slug)
  } finally {
    await pool.end()
  }
  await shows(request, '/regeln', renamed, false)
  await shows(request, `${OTHER}/regeln`, renamed, false)
})

test('Admin: Hilfe-Nummern anlegen, bearbeiten, löschen – sofort auf /hilfe beider Server', async ({ browser, request }) => {
  const admin = await moderator(browser, 'admin')
  const name = `Testhilfe ${Date.now().toString(36)}`
  await html(request, '/hilfe')
  await html(request, `${OTHER}/hilfe`)

  await admin.goto('/admin/hilfe')
  const neu = admin.getByRole('form', { name: 'Neue Nummer' })
  await neu.getByLabel('Name').fill(name)
  await neu.getByLabel('Nummer').fill('0800 000 000')
  await neu.getByLabel('Zeiten').fill('werktags')
  await neu.getByLabel('Für wen').fill('für den Test')
  await neu.getByRole('button', { name: 'Hinzufügen' }).click()
  await expect(admin.getByText(`«${name}» hinzugefügt.`)).toBeVisible()
  await shows(request, '/hilfe', name)
  await shows(request, `${OTHER}/hilfe`, name)

  // Ohne Nummer und Link geht es nicht.
  const row = admin.getByRole('form', { name })
  await row.getByLabel('Nummer').fill('')
  await row.getByRole('button', { name: 'Speichern' }).click()
  await expect(row.getByRole('alert')).toContainText('Nummer oder einen Link')

  await row.getByLabel('Nummer').fill('0800 111 111')
  await row.getByLabel('Zeiten').fill('rund um die Uhr (Test)')
  await row.getByRole('button', { name: 'Speichern' }).click()
  await expect(admin.getByText(`«${name}» gespeichert.`)).toBeVisible()
  await shows(request, `${OTHER}/hilfe`, 'rund um die Uhr (Test)')

  await row.getByRole('button', { name: 'Löschen' }).click()
  await admin.getByRole('dialog').getByRole('button', { name: 'Löschen' }).click()
  await expect(admin.getByText(`«${name}» gelöscht.`)).toBeVisible()
  await expect(row).toHaveCount(0)
  await shows(request, '/hilfe', name, false)
  await shows(request, `${OTHER}/hilfe`, name, false)
})

test('Admin: Schritte anlegen, bearbeiten, löschen', async ({ browser }) => {
  const admin = await moderator(browser, 'admin')
  const text = `Testschritt ${Date.now().toString(36)}: ein Glas Wasser trinken.`
  await admin.goto('/admin/schritte')
  const neu = admin.getByRole('form', { name: 'Neuer Schritt' })
  await neu.getByLabel('Text', { exact: true }).fill(text)
  await neu.getByRole('button', { name: 'Hinzufügen' }).click()
  await expect(admin.getByText('Schritt hinzugefügt.')).toBeVisible()
  await expect(neu.getByLabel('Text', { exact: true })).toHaveValue('')
  const row = admin.getByRole('form', { name: `Schritt: ${text}` })
  await expect(row).toBeVisible()

  await row.getByLabel('Text auf Französisch').fill('Boire un verre d’eau (test).')
  await row.getByRole('button', { name: 'Speichern' }).click()
  await expect(admin.getByText('Schritt gespeichert.')).toBeVisible()
  await admin.reload()
  await expect(row.getByLabel('Text auf Französisch')).toHaveValue('Boire un verre d’eau (test).')

  await row.getByRole('button', { name: 'Löschen' }).click()
  // Abbrechen löscht nichts.
  await admin.getByRole('dialog').getByRole('button', { name: 'Abbrechen' }).click()
  await expect(row).toBeVisible()
  await row.getByRole('button', { name: 'Löschen' }).click()
  await admin.getByRole('dialog').getByRole('button', { name: 'Löschen' }).click()
  await expect(admin.getByText('Schritt gelöscht.')).toBeVisible()
  await expect(row).toHaveCount(0)
  await admin.reload()
  await expect(admin.getByRole('form', { name: `Schritt: ${text}` })).toHaveCount(0)
})

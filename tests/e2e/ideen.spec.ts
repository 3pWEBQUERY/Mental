import { execSync } from 'node:child_process'
import { expect, test } from '@playwright/test'
import { Pool } from 'pg'
import { register, share } from './helpers'

async function sql(q: string, params: unknown[] = []) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  try {
    return (await pool.query(q, params)).rows
  } finally {
    await pool.end()
  }
}

test('Hilfe: Telefon-Sätze, Notfallplan und 5-4-3-2-1', async ({ page }) => {
  await register(page)
  // Notfallplan anlegen
  await page.goto('/ich?tab=fuermich')
  await page.getByLabel(/Woran ich merke/).fill('Ich ziehe mich zurück und schlafe kaum.')
  await page.getByLabel(/Wen ich um Hilfe bitten kann/).fill('Mia 079 000 00 00')
  await page.getByRole('button', { name: 'Speichern' }).click()
  await expect(page.getByText('Ich ziehe mich zurück und schlafe kaum.')).toBeVisible()

  // Hilfe-Dialog: Telefon-Sätze aufklappen, Notfallplan mit einem Tipp
  await page.goto('/lichtung')
  await page.locator('nav.rail').getByRole('button', { name: 'Sofort Hilfe' }).click()
  const help = page.getByRole('dialog', { name: 'Sofort Hilfe' })
  await help.getByText('Was ich am Telefon sagen kann').click()
  await expect(help.getByText(/Ich weiss nicht, wie ich anfangen soll/)).toBeVisible()
  await help.getByRole('button', { name: 'Mein Notfallplan' }).click()
  const plan = page.getByRole('dialog', { name: 'Mein Notfallplan' })
  await expect(plan.getByText('Mia 079 000 00 00')).toBeVisible()
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')

  // 5-4-3-2-1 aus dem Raum
  await page.getByRole('button', { name: /5-4-3-2-1/ }).first().click()
  const g = page.getByRole('dialog', { name: '5-4-3-2-1' })
  await expect(g.getByText('Nenne fünf Dinge, die du sehen kannst.')).toBeVisible()
  for (let i = 0; i < 5; i++) await g.getByRole('button', { name: 'Weiter' }).click()
  await expect(g.getByText(/Du bist hier/)).toBeVisible()
})

test('Brief an mein späteres Ich erscheint nach «Schwer»', async ({ page }) => {
  await register(page)
  await page.goto('/ich?tab=fuermich')
  await page.locator('#letter-text').fill('Liebes Ich, heute war der See ruhig und du auch.')
  await page.getByRole('button', { name: 'Brief ablegen' }).click()
  await expect(page.locator('.letters')).toContainText('wartet')
  await page.goto('/lichtung')
  await page.getByRole('radio', { name: 'Schwer' }).click()
  const dlg = page.getByRole('dialog', { name: 'Brief an mein späteres Ich' })
  await expect(dlg.getByText('heute war der See ruhig')).toBeVisible()
  await dlg.getByRole('button', { name: 'Danke' }).click()
  await page.goto('/ich?tab=fuermich')
  await expect(page.locator('.letters')).toContainText('gelesen am')
})

test('Ratschlag-Hinweis auf «Zuhören» und «Ein Gedanke wartet»', async ({ browser }) => {
  const a = await (await browser.newContext()).newPage()
  const b = await (await browser.newContext()).newPage()
  await register(a)
  await register(b)
  const text = `Ich will nur gehört werden ${Date.now()}`
  await share(a, text) // Standard-Bedürfnis: Zuhören

  await b.goto('/lichtung/wartet')
  await expect(b.getByRole('heading', { name: 'Ein Gedanke wartet' })).toBeVisible()
  await expect(b.locator('.waiting-one article')).toHaveCount(1)
  // Der neueste unbeantwortete kommt zuletzt – bis zu ihm weitergehen.
  for (let i = 0; i < 40 && !(await b.locator('.waiting-one article', { hasText: text }).count()); i++) {
    await b.getByRole('button', { name: 'Nächster Gedanke' }).click()
    await b.waitForTimeout(300)
  }
  const card = b.locator('.waiting-one article', { hasText: text })
  await card.getByLabel('Antwort schreiben').fill('Du solltest mal mit jemandem reden.')
  await card.getByRole('button', { name: 'Antwort senden' }).click()
  await expect(card.getByText(/Das klingt nach einem Rat/)).toBeVisible()
  await card.getByLabel('Antwort schreiben').fill('Ich höre dich. Das klingt wirklich schwer.')
  await card.getByRole('button', { name: 'Antwort senden' }).click()
  await expect(card.locator('.replies')).toContainText('Ich höre dich. Das klingt wirklich schwer.')
})

test('Gedanke loslassen und Diskret-Modus', async ({ page }) => {
  await register(page)
  const text = `Loslassen ${Date.now()}`
  await page.getByRole('button', { name: 'Was trägst du heute mit dir?' }).click()
  await page.locator('#composer-text').fill(text)
  await page.getByRole('radio', { name: 'nach 1 Tag' }).click()
  await page.getByRole('button', { name: 'Teilen', exact: true }).click()
  await expect(page.locator('article', { hasText: text })).toContainText('Löst sich am')

  // Zeit vorspulen und den Worker-Job laufen lassen
  await sql(`UPDATE posts SET expires_at = now() - interval '1 minute' WHERE body = $1`, [text])
  execSync(`npx tsx -e "import('./worker/jobs/posts.ts').then((j) => j.expirePosts()).then(() => process.exit(0))"`, { stdio: 'ignore' })
  await page.reload()
  await expect(page.locator('article', { hasText: text })).toHaveCount(0)
  expect(await sql(`SELECT 1 FROM posts WHERE body = $1`, [text])).toHaveLength(0)

  // Diskret: neutraler Titel, Inhalt verschwimmt beim Verlassen
  await page.goto('/einstellungen')
  await page.waitForLoadState('networkidle')
  await page.locator('label.switch', { hasText: 'Diskret' }).click()
  await expect(page).toHaveTitle('Notizen')
  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  await expect(page.locator('html')).toHaveAttribute('data-veiled', '1')
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.locator('html')).not.toHaveAttribute('data-veiled', '1')
  await page.goto('/lichtung')
  await expect(page).toHaveTitle('Notizen')
})

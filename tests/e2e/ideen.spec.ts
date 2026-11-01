import { execSync } from 'node:child_process'
import { expect, test } from '@playwright/test'
import { Pool } from 'pg'
import { register, share, closeExtraContexts } from './helpers'

test.afterEach(closeExtraContexts)

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
  await page.goto('/start')
  await page.locator('nav.rail').getByRole('button', { name: 'Sofort Hilfe' }).click()
  const help = page.getByRole('dialog', { name: 'Sofort Hilfe' })
  await help.getByText('Was ich am Telefon sagen kann').click()
  await expect(help.getByText(/Ich weiss nicht, wie ich anfangen soll/)).toBeVisible()
  await help.getByRole('button', { name: 'Mein Notfallplan' }).click()
  const plan = page.getByRole('dialog', { name: 'Mein Notfallplan' })
  await expect(plan.getByText('Mia 079 000 00 00')).toBeVisible()
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')

  // 5-4-3-2-1 im Raum: Der Umschalter macht aus der Kugel die Ziffern, der Text gleitet als Folie herein.
  const sw = page.getByRole('radiogroup', { name: 'Übung' })
  await sw.getByRole('radio', { name: '5-4-3-2-1' }).click()
  await expect(sw.getByRole('radio', { name: '5-4-3-2-1' })).toHaveAttribute('aria-checked', 'true')
  // Die Atem-Folie ist jetzt verborgen und nicht bedienbar.
  await expect(page.locator('section.stage').getByRole('button', { name: '1 Minute atmen' })).toBeHidden()
  for (const step of ['fünf Dinge, die du sehen', 'vier Dinge, die du spüren', 'drei Dinge, die du hören', 'zwei Dinge, die du riechen', 'eine Sache, die du schmecken']) {
    await expect(page.locator('.ground-text')).toContainText(`Nenne ${step}`)
    await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  }
  await expect(page.locator('.ground-text')).toHaveText('Du bist hier.')
  await page.getByRole('button', { name: 'Fertig', exact: true }).click()
  await expect(sw.getByRole('radio', { name: 'Atmen' })).toHaveAttribute('aria-checked', 'true')
  await expect(page.locator('section.stage').getByRole('button', { name: '1 Minute atmen' })).toBeVisible()

  // Aus «Sofort Hilfe» heraus läuft die Übung ebenfalls im Raum – kein zusätzlicher Dialog.
  await page.locator('nav.rail').getByRole('button', { name: 'Sofort Hilfe' }).click()
  await page.getByRole('dialog', { name: 'Sofort Hilfe' }).getByRole('button', { name: /5-4-3-2-1/ }).click()
  await expect(page.locator('.ground-text')).toHaveText('Nenne fünf Dinge, die du sehen kannst.')
  await expect(page.getByRole('dialog', { name: '5-4-3-2-1' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Zurück zum Atmen' }).click()
  await expect(page.locator('section.stage').getByRole('button', { name: '1 Minute atmen' })).toBeVisible()
})

test('Brief an mein späteres Ich erscheint nach «Schwer»', async ({ page }) => {
  await register(page)
  await page.goto('/ich?tab=fuermich')
  await page.locator('#letter-text').fill('Liebes Ich, heute war der See ruhig und du auch.')
  await page.getByRole('button', { name: 'Brief ablegen' }).click()
  await expect(page.locator('.letters')).toContainText('wartet')
  await page.goto('/start')
  await page.getByRole('radio', { name: 'Schwer' }).click()
  const dlg = page.getByRole('dialog', { name: 'Brief an mein späteres Ich' })
  await expect(dlg.getByText('heute war der See ruhig')).toBeVisible()
  await dlg.getByRole('button', { name: 'Danke' }).click()
  await expect(dlg).toHaveCount(0)
  await page.goto('/ich?tab=fuermich')
  await expect(page.locator('.letters')).toContainText('gelesen am')
})

test('Ratschlag-Hinweis auf «Zuhören» und «Ein Gedanke wartet»', async ({ browser }) => {
  const a = await (await browser.newContext()).newPage()
  const b = await (await browser.newContext()).newPage()
  await register(a)
  await register(b)
  const text = `Ich will nur gehört werden ${Date.now()}`
  // «Ein Gedanke wartet» zeigt den ältesten unbeantworteten zuerst – die übrigen Test-Gedanken
  // dieses Laufs (eigene Test-Datenbank) schliessen, damit unserer der erste ist.
  await sql(`UPDATE posts SET closed = true WHERE reply_count = 0`)
  await share(a, text) // Standard-Bedürfnis: Zuhören

  await b.goto('/start/wartet')
  await expect(b.getByRole('heading', { name: 'Ein Gedanke wartet' })).toBeVisible()
  await expect(b.locator('.waiting-one article')).toHaveCount(1)
  const card = b.locator('.waiting-one article', { hasText: text })
  await expect(card).toHaveCount(1)
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
  await page.goto('/start')
  await expect(page).toHaveTitle('Notizen')
})

test('Stimmung per Pfeiltasten: ein Check-in statt vier, Fokus bleibt bei 5-4-3-2-1 erhalten', async ({ page }) => {
  const { username } = await register(page)
  const mood = page.getByRole('radiogroup', { name: 'Stimmung' })
  await mood.getByRole('radio', { name: 'Schwer' }).focus()
  await page.keyboard.press('Space')
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight')
  await expect(mood.getByRole('radio', { name: 'Leichter' })).toHaveAttribute('aria-checked', 'true')
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  try {
    const count = async () =>
      (await pool.query(`SELECT count(*)::int AS n FROM checkins c JOIN users u ON u.id = c.user_id WHERE u.username = $1`, [username])).rows[0].n
    // Gespeichert wird nach der kurzen Pause – genau einmal, mit der zuletzt gewählten Stimmung.
    await expect.poll(count, { timeout: 5000 }).toBe(1)
    await page.waitForTimeout(1200)
    expect(await count()).toBe(1)
  } finally {
    await pool.end()
  }

  // «Zurück zum Atmen» liegt danach in einer inerten Folie – der Fokus wandert zum Umschalter, nicht an den Seitenanfang.
  const sw = page.getByRole('radiogroup', { name: 'Übung' })
  await sw.getByRole('radio', { name: '5-4-3-2-1' }).click()
  await page.getByRole('button', { name: 'Zurück zum Atmen' }).click()
  await expect(sw.getByRole('radio', { name: 'Atmen' })).toBeFocused()
})

test('Einführung beim ersten Besuch: drei Karten, erscheint danach nicht wieder', async ({ page }) => {
  await register(page, 'Testperson', { keepOnboarding: true })
  const dlg = page.getByRole('dialog', { name: 'Willkommen' })
  await expect(dlg).toBeVisible()
  await expect(dlg).toContainText('1 von 3')
  await expect(dlg.getByRole('button', { name: 'Weiter' })).toBeFocused()
  await dlg.getByRole('button', { name: 'Weiter' }).click()
  await expect(dlg).toContainText('Zuhören reicht oft.')
  await dlg.getByRole('button', { name: 'Weiter' }).click()
  await expect(dlg).toContainText('143')
  await expect(dlg.getByRole('button', { name: 'Überspringen' })).toHaveCount(0)
  const saved = page.waitForResponse((r) => r.request().method() === 'POST' && r.request().headers()['next-action'] !== undefined)
  await dlg.getByRole('button', { name: 'Los geht’s' }).click()
  await expect(dlg).toBeHidden()
  await saved
  await page.reload()
  await page.waitForTimeout(1200)
  await expect(page.getByRole('dialog', { name: 'Willkommen' })).toBeHidden()
})

test('Notfallplan: nur den Plan drucken, Offline-Kopie auf /offline, beim Abmelden gelöscht', async ({ page }) => {
  await register(page)
  await page.goto('/ich?tab=fuermich')
  await page.getByLabel(/Woran ich merke/).fill('Ich ziehe mich zurück.')
  await page.getByLabel(/Wen ich um Hilfe bitten kann/).fill('Mia 079 000 00 00')
  await page.getByRole('button', { name: 'Speichern' }).click()
  await expect(page.locator('.plan-print')).toContainText('Mia 079 000 00 00')

  // Drucken markiert die Seite, damit @media print nur den Plan zeigt.
  await page.evaluate(() => {
    window.print = () => {
      ;(window as unknown as { printed: boolean }).printed = document.documentElement.classList.contains('print-plan')
    }
  })
  await page.getByRole('button', { name: 'Drucken' }).click()
  expect(await page.evaluate(() => (window as unknown as { printed: boolean }).printed)).toBe(true)
  await page.emulateMedia({ media: 'print' })
  await page.evaluate(() => document.documentElement.classList.add('print-plan'))
  await expect(page.locator('.plan-print-note')).toBeVisible()
  await expect(page.locator('nav.rail')).toBeHidden()
  await page.evaluate(() => document.documentElement.classList.remove('print-plan'))
  await page.emulateMedia({ media: 'screen' })

  // Offline-Kopie einschalten → /offline zeigt den Plan (ohne Next.js-JavaScript, per Inline-Skript).
  await page.getByLabel(/Auch ohne Internet/).check()
  await expect(page.getByText('auch offline auf diesem Gerät')).toBeVisible()
  await page.goto('/offline')
  await expect(page.locator('#offline-plan')).toBeVisible()
  await expect(page.locator('#offline-plan')).toContainText('Mia 079 000 00 00')
  await expect(page.locator('#offline-plan')).toContainText('Wen ich um Hilfe bitten kann')

  // Abmelden löscht die Kopie.
  await page.goto('/einstellungen')
  await page.getByRole('button', { name: 'Abmelden', exact: true }).click()
  await page.waitForURL('**/anmelden')
  await page.goto('/offline')
  await expect(page.locator('#offline-plan')).toBeHidden()
})

test('Ein kleiner Schritt: bei jedem Neuladen ein anderer, Feed und Seitenleiste gleich, erledigt bleibt erledigt', async ({ page }) => {
  await register(page)
  const text = () => page.locator('.side .step p').first().textContent()
  const seen: string[] = []
  for (let i = 0; i < 6; i++) {
    if (i) await page.reload()
    await expect(page.locator('.side .step')).toBeVisible()
    const t = (await text())!.trim()
    // Schmale Ansicht (im Feed) zeigt denselben Schritt wie die Seitenleiste.
    expect((await page.locator('.step-inline .step p').first().textContent())!.trim()).toBe(t)
    if (seen.length) expect(t, `Neuladen ${i}`).not.toBe(seen[seen.length - 1])
    seen.push(t)
  }
  // Erledigt: bleibt beim Neuladen stehen.
  await page.locator('.side .step').getByRole('button', { name: 'Gemacht' }).click()
  await expect(page.locator('.side .step.done')).toBeVisible()
  const done = (await text())!.trim()
  await page.reload()
  await expect(page.locator('.side .step.done')).toBeVisible()
  expect((await text())!.trim()).toBe(done)
})

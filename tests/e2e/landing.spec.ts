import { expect, test } from '@playwright/test'

test('Startseite: Sternenhimmel, Header ohne Hintergrund darauf, Frage führt zur Registrierung', async ({ page }) => {
  await page.goto('/')
  const hero = page.locator('section.hero')
  await expect(hero.getByRole('heading', { level: 1 })).toHaveText('Ein Ort, an dem niemand bewertet wird.')
  // Hintergrundbild geladen.
  await expect.poll(() => page.locator('.hero-bg').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
  // Header liegt auf dem Bild – ohne Hintergrund.
  const header = page.locator('header.public-top')
  await expect(header).toHaveClass(/on-hero/)
  expect(await header.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)')
  const [h, s] = await Promise.all([header.boundingBox(), hero.boundingBox()])
  expect(h!.y).toBeGreaterThanOrEqual(s!.y)
  expect(h!.y + h!.height).toBeLessThan(s!.y + s!.height)
  // Schnellzugriffe
  const quick = page.getByRole('navigation', { name: 'Schnell erreichbar' })
  await expect(quick.getByRole('link', { name: 'Hilfe' })).toHaveAttribute('href', '/hilfe')
  await expect(quick.getByRole('link', { name: 'Hausregeln' })).toHaveAttribute('href', '/regeln')
  await expect(quick.getByRole('link', { name: 'Transparenz' })).toHaveAttribute('href', '/transparenz')
  await expect(hero.getByRole('link', { name: 'Anmelden' })).toHaveAttribute('href', '/anmelden')
  await hero.getByRole('link', { name: /Was trägst du heute mit dir\? – Konto erstellen/ }).click()
  await page.waitForURL('**/registrieren')
})

test('Startseite auf Französisch', async ({ browser }) => {
  const page = await (await browser.newContext({ locale: 'fr-CH' })).newPage()
  await page.goto('/')
  await expect(page.locator('section.hero')).toContainText('Qu’est-ce que tu portes avec toi aujourd’hui ?')
  await expect(page.getByRole('navigation', { name: 'Accès rapide' }).getByRole('link', { name: 'Aide' })).toHaveAttribute('href', '/aide')
})

test('Datenschutz und Impressum: auf Deutsch ganz deutsch, Hinweis nur in der gewählten Sprache', async ({ browser }) => {
  const de = await (await browser.newContext({ locale: 'de-CH' })).newPage()
  for (const path of ['/datenschutz', '/impressum']) {
    await de.goto(path)
    await expect(de.getByText('Ce texte juridique')).toBeHidden()
    await expect(de.getByText('Questo testo giuridico')).toBeHidden()
    expect(await de.locator('main').innerText()).not.toMatch(/juridique|giuridico/)
  }
  const ctx = await browser.newContext()
  const fr = await ctx.newPage()
  await fr.goto('/')
  await ctx.addCookies([{ name: 'lichtung_lang', value: 'fr', url: fr.url() }])
  for (const path of ['/datenschutz', '/impressum']) {
    await fr.goto(path)
    await expect(fr.getByText('Ce texte juridique')).toBeVisible()
    await expect(fr.getByText('Questo testo giuridico')).toBeHidden()
  }
})

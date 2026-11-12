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

test('Startseite: Video-Hintergrund lädt erst nach der Seite und läuft in Schleife – nicht bei «weniger Bewegung»', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  await page.goto('/')
  const video = page.locator('video.hero-video')
  await expect(video).toHaveClass(/\bon\b/, { timeout: 20_000 })
  const state = await video.evaluate((v: HTMLVideoElement) => ({ src: v.currentSrc, loop: v.loop, muted: v.muted, paused: v.paused }))
  expect(state.src).toMatch(/\/hero\/v1\/desktop-(av1|h264)\.mp4$/)
  expect(state).toMatchObject({ loop: true, muted: true, paused: false })
  await ctx.close()

  // Hochformat: Ausschnitt-Fassung.
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const p = await phone.newPage()
  await p.goto('/')
  await expect(p.locator('video.hero-video')).toHaveClass(/\bon\b/, { timeout: 20_000 })
  expect(await p.locator('video.hero-video').evaluate((v: HTMLVideoElement) => v.currentSrc)).toMatch(/\/hero\/v1\/mobile-(av1|h264)\.mp4$/)
  await phone.close()

  // Weniger Bewegung: nur das Standbild, das Video wird gar nicht geladen.
  const calm = await browser.newContext({ reducedMotion: 'reduce' })
  const c = await calm.newPage()
  let requested = false
  c.on('request', (r) => {
    if (r.url().includes('/hero/v1/')) requested = true
  })
  await c.goto('/')
  await c.waitForTimeout(3000)
  expect(requested).toBe(false)
  await expect(c.locator('video.hero-video')).not.toHaveClass(/\bon\b/)
  await calm.close()
})

test('Footer: runde Knöpfe zu den sozialen Medien, öffnen in neuem Fenster', async ({ page }) => {
  await page.goto('/hilfe')
  const social = page.getByRole('navigation', { name: 'Jiaia in den sozialen Medien' })
  const ig = social.getByRole('link', { name: 'Jiaia auf Instagram (öffnet ein neues Fenster)' })
  await expect(ig).toHaveAttribute('href', 'https://www.instagram.com/jiaia.app/')
  await expect(ig).toHaveAttribute('target', '_blank')
  await expect(ig).toHaveAttribute('rel', /noopener/)
  const box = await ig.boundingBox()
  expect(box && Math.round(box.width) === Math.round(box.height) && box.width >= 44).toBe(true)
  // Nur Konten mit Adresse erscheinen – keine toten Knöpfe.
  for (const a of await social.getByRole('link').all()) await expect(a).toHaveAttribute('href', /^https:\/\//)
})

test('Von der Startseite zur Hilfe ohne Neuladen: kein dunkler Himmel hinter der Hilfe, Schrift lesbar', async ({ page }) => {
  await page.goto('/')
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(5, 10, 22)')
  await page.locator('.public-top').getByRole('link', { name: 'Sofort Hilfe' }).click()
  await page.waitForURL('**/hilfe')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Sofort')
  // Die Startseite bleibt versteckt im Dokument (React Activity) – ihr Himmel darf die Hilfe nicht einfärben.
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(239, 236, 228)')
  // Zurück: wieder der dunkle Himmel.
  await page.goBack()
  await page.waitForURL((u) => u.pathname === '/')
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(5, 10, 22)')
})

test('Footer: Instagram, X und TikTok; App-Store-Bereich darüber (nicht auf der Hilfe, beim Anmelden, Registrieren, Wiederherstellen); Logo als Tab-Icon', async ({ page, request }) => {
  await page.goto('/')
  const social = page.locator('.public-foot .social')
  await expect(social.locator('a[href="https://www.instagram.com/jiaia.app/"]')).toBeVisible()
  await expect(social.locator('a[href="https://x.com/Jiaiadotapp"]')).toBeVisible()
  await expect(social.locator('a[href="https://www.tiktok.com/@jiaia.app"]')).toBeVisible()
  const store = page.getByRole('region', { name: 'Jiaia als App' })
  await expect(store.getByRole('link', { name: /App Store/ })).toHaveAttribute('href', 'https://apps.apple.com/ch/app/jiaia/id6829498048')
  // Der Bereich steht direkt über dem Footer.
  expect(await page.evaluate(() => document.querySelector('.app-store')?.nextElementSibling?.className)).toContain('public-foot')
  // Logo im Tab: favicon.ico und SVG-Icon sind verlinkt und abrufbar.
  const icons = await page.locator('link[rel="icon"]').evaluateAll((ls) => ls.map((l) => (l as HTMLLinkElement).getAttribute('href')!))
  expect(icons.some((h) => h.startsWith('/favicon.ico'))).toBe(true)
  expect(icons.some((h) => h.startsWith('/icon.svg'))).toBe(true)
  expect((await request.get('/favicon.ico')).headers()['content-type']).toContain('image/')
  // Auf der Hilfe lenkt nichts von den Nummern ab.
  await page.goto('/hilfe')
  await expect(page.locator('.app-store')).toHaveCount(0)
  // Auch nicht beim Anmelden, Registrieren und Wiederherstellen.
  for (const path of ['/anmelden', '/registrieren', '/wiederherstellen']) {
    await page.goto(path)
    await expect(page.locator('.public-foot')).toBeVisible()
    await expect(page.locator('.app-store')).toHaveCount(0)
  }
})

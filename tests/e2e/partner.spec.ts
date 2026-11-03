import { expect, test, type APIRequestContext } from '@playwright/test'
import { moderator } from './helpers'

const OTHER = `http://localhost:${Number(process.env.E2E_PORT ?? 3100) + 1}`
const SVG = (fill: string) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="80" viewBox="0 0 240 80"><script>alert(1)</script><rect width="240" height="80" rx="12" fill="${fill}"/></svg>`)

async function shows(request: APIRequestContext, url: string, text: string, present = true) {
  await expect
    .poll(async () => (await (await request.get(url)).text()).includes(text), { timeout: 8_000, message: `${url} ${present ? 'zeigt' : 'zeigt nicht mehr'} «${text}»` })
    .toBe(present)
}

test('Admin: Partner anlegen, Logo hochladen, auf der Startseite zeigen, löschen', async ({ browser, request }) => {
  test.slow()
  const admin = await moderator(browser, 'admin')
  const name = `Testpartner ${Date.now().toString(36)}`

  await admin.goto('/admin/partner')
  const neu = admin.getByRole('form', { name: 'Neuer Partner' })
  await neu.getByLabel('Name').fill(name)
  await neu.getByLabel('Link zur Website').fill('https://example.org/')
  await neu.getByRole('button', { name: 'Hinzufügen' }).click()
  await expect(admin.getByText(`«${name}» hinzugefügt.`)).toBeVisible()
  // Ohne Logo: Name auf der Startseite, auf beiden Servern.
  await shows(request, '/', name)
  await shows(request, `${OTHER}/`, name)

  // Logo hochladen (SVG mit Skript) und direkt zuweisen.
  const upload = admin.getByRole('form', { name: 'Logo hochladen' })
  await upload.getByLabel(/Bilddatei/).setInputFiles({ name: 'logo-test.svg', mimeType: 'image/svg+xml', buffer: SVG('#c4552d') })
  await upload.getByLabel('Direkt einem Partner zuweisen').selectOption({ label: `Logo für: ${name}` })
  await upload.getByRole('button', { name: 'Hochladen' }).click()
  await expect(admin.getByText(`Logo hochgeladen und «${name}» zugewiesen.`)).toBeVisible()
  await expect(admin.getByRole('list', { name: 'Hochgeladene Logos' }).getByText(`genutzt von ${name}`)).toBeVisible()

  // Startseite: Logo mit Name als Alternativtext, Link in neuem Fenster.
  const page = await browser.newPage()
  await expect.poll(async () => (await page.goto('/'), await page.getByRole('img', { name }).count()), { timeout: 8_000 }).toBe(1)
  const link = page.getByRole('link', { name: `${name} (öffnet ein neues Fenster)` })
  await expect(link).toHaveAttribute('href', 'https://example.org/')
  await expect(link).toHaveAttribute('target', '_blank')
  const src = await page.getByRole('img', { name }).getAttribute('src')
  const res = await request.get(src!)
  expect(res.status()).toBe(200)
  expect(res.headers()['content-type']).toBe('image/webp')
  expect(res.headers()['cache-control']).toContain('immutable')
  const bytes = await res.body()
  expect(bytes.subarray(0, 4).toString()).toBe('RIFF')
  expect(bytes.includes('script')).toBe(false)
  await shows(request, `${OTHER}/`, src!)

  // Keine Bilddatei → Fehler am Formular. Ohne Anmeldung → kein Upload.
  await upload.getByLabel(/Bilddatei/).setInputFiles({ name: 'kein-bild.png', mimeType: 'image/png', buffer: Buffer.from('kein Bild') })
  await upload.getByRole('button', { name: 'Hochladen' }).click()
  await expect(upload.getByRole('alert')).toContainText('liess sich nicht lesen')
  const anon = await request.post('/api/admin/partner-media', { multipart: { file: { name: 'x.svg', mimeType: 'image/svg+xml', buffer: SVG('#000') } } })
  expect(anon.status()).toBe(403)

  // Ausblenden: Haken weg → nicht mehr auf der Startseite.
  const card = admin.getByRole('form', { name: `Partner ${name}`, exact: true })
  await card.getByText('Auf der Startseite').click()
  await card.getByRole('button', { name: 'Speichern' }).click()
  await expect(admin.getByText(`«${name}» gespeichert.`)).toBeVisible()
  await shows(request, '/', name, false)
  await card.getByText('Auf der Startseite').click()
  await card.getByRole('button', { name: 'Speichern' }).click()
  await shows(request, '/', name)

  // Logo löschen → Partner bleibt mit Namen.
  const item = admin.getByRole('listitem').filter({ hasText: `genutzt von ${name}` })
  await item.getByRole('button', { name: 'Löschen' }).click()
  await admin.getByRole('dialog').getByRole('button', { name: 'Löschen' }).click()
  await expect(admin.getByText('«logo-test.svg» gelöscht.')).toBeVisible()
  await shows(request, '/', src!, false)
  await shows(request, '/', name)
  expect((await request.get(src!)).status()).toBe(404)

  // Partner löschen → weg, auf beiden Servern.
  await card.getByRole('button', { name: 'Löschen' }).click()
  await admin.getByRole('dialog').getByRole('button', { name: 'Löschen' }).click()
  await expect(admin.getByText(`«${name}» gelöscht.`)).toBeVisible()
  await shows(request, '/', name, false)
  await shows(request, `${OTHER}/`, name, false)
})

import { expect, test, type APIRequestContext } from '@playwright/test'
import { moderator, openComposer, register } from './helpers'

/** Vorgerenderte Hilfeseiten frischen sich im Hintergrund auf – kurz warten, bis der Text da ist. */
async function pageShows(request: APIRequestContext, url: string, texts: string[]) {
  await expect
    .poll(async () => {
      const html = await (await request.get(url)).text()
      return texts.every((t) => html.includes(t))
    }, { timeout: 15_000, message: `${url}: ${texts.join(', ')}` })
    .toBe(true)
}

test('Neue Kreise: in der Liste, «Einfach so» ist voreingestellt, Pflicht-Inhaltshinweis bei «Angehörige»', async ({ browser }) => {
  const page = await browser.newPage()
  await register(page)
  const list = page.locator('aside.side ul.circles')
  for (const name of ['Beziehungen & Familie', 'Schule & Ausbildung', 'Schlaf', 'Angehörige', 'Queer & Identität', 'Gute Momente', 'Einfach so'])
    await expect(list.getByText(name, { exact: true })).toBeVisible()

  await openComposer(page)
  const dlg = page.getByRole('dialog')
  const circles = dlg.getByRole('radiogroup', { name: 'In welchem Kreis?' })
  await expect(circles.getByRole('radio', { name: 'Einfach so', exact: true })).toHaveAttribute('aria-checked', 'true')
  const cw = dlg.getByRole('checkbox', { name: /Kann belastend sein/ })
  await expect(cw).not.toBeChecked()
  await expect(cw).toBeEnabled()
  // «Angehörige»: Inhaltshinweis fest an.
  await circles.getByRole('radio', { name: 'Angehörige', exact: true }).click()
  await expect(cw).toBeChecked()
  await expect(cw).toBeDisabled()
  await expect(dlg.getByText('In diesem Kreis ist der Inhaltshinweis immer an')).toBeVisible()
  const text = `Mein Bruder ist seit gestern in der Klinik ${Date.now()}`
  await page.locator('#composer-text').fill(text)
  await dlg.getByRole('button', { name: 'Teilen', exact: true }).click()
  await expect(page.locator('dialog[open]')).toHaveCount(0)

  // Andere sehen den Gedanken verschwommen, bis sie ihn antippen.
  const other = await browser.newPage()
  await register(other)
  await other.goto('/start?kreis=angehoerige')
  const card = other.locator('article', { hasText: 'Kann belastend sein' }).first()
  await expect(card).toBeVisible()
  await expect(card.getByText('Antippen zum Lesen')).toBeVisible()

  // Hilfe zu diesem Thema im Kreis.
  const help = other.getByRole('region', { name: 'Hilfe zu diesem Thema' })
  await expect(help).toBeVisible()
  await expect(help.getByText('Pro Mente Sana')).toBeVisible()
  await other.goto('/start?kreis=queer')
  await expect(other.getByRole('region', { name: 'Hilfe zu diesem Thema' }).getByText('du-bist-du')).toBeVisible()
  // Ohne Themen-Hilfe (Gute Momente) kein leerer Kasten.
  await other.goto('/start?kreis=gute-momente')
  await expect(other.locator('.filter')).toContainText('Gute Momente')
  await expect(other.getByRole('region', { name: 'Hilfe zu diesem Thema' })).toHaveCount(0)
})

test('Hilfeseiten: «Nach Thema» auf Deutsch, Französisch und Italienisch', async ({ request }) => {
  await pageShows(request, '/hilfe', ['Nach Thema', 'Opferhilfe Schweiz', 'Angehörige'])
  await pageShows(request, '/aide', ['Par thème', 'Fondation Agnodice', 'Relations &amp; famille'])
  await pageShows(request, '/aiuto', ['Per tema', 'Imbarco Immediato', 'Aiuto alle vittime'])
})

test('Admin: Inhaltshinweis je Kreis und Hilfe einem Kreis zuordnen', async ({ browser }) => {
  const admin = await moderator(browser, 'admin')
  // Ein älterer Gedanke in «Schlaf» ohne Inhaltshinweis …
  const author = await browser.newPage()
  await register(author)
  await openComposer(author)
  const text = `Wieder seit drei Uhr wach ${Date.now()}`
  await author.locator('#composer-text').fill(text)
  await author.getByRole('dialog').getByRole('radio', { name: 'Schlaf', exact: true }).click()
  await author.getByRole('button', { name: 'Teilen', exact: true }).click()
  await expect(author.locator('dialog[open]')).toHaveCount(0)

  const card = admin.getByRole('form', { name: 'Kreis Schlaf', exact: true })
  const toggle = card.getByRole('checkbox', { name: 'Inhaltshinweis immer an' })
  try {
    await admin.goto('/admin/kreise')
    await card.locator('label.switch', { hasText: 'Inhaltshinweis immer an' }).click()
    await expect(toggle).toBeChecked()
    await card.getByRole('button', { name: 'Speichern' }).click()
    await expect(admin.getByText('Kreis «Schlaf» gespeichert.')).toBeVisible()
    // … ist danach für andere verschwommen.
    const reader = await browser.newPage()
    await register(reader)
    await reader.goto('/start?kreis=schlaf')
    await expect(reader.locator('article', { hasText: 'Antippen zum Lesen' }).first()).toBeVisible()
    await expect(reader.getByText(text)).toHaveCount(0)

    // Hilfe dem Kreis zuordnen: erscheint im Kreis, nicht in der allgemeinen Hilfe.
    const name = `Schlafberatung ${Date.now().toString(36)}`
    await admin.goto('/admin/hilfe')
    const neu = admin.getByRole('form', { name: 'Neue Nummer' })
    await neu.getByLabel('Name').fill(name)
    await neu.getByLabel('Link').fill('https://example.org/schlaf')
    await neu.getByLabel('Zeiten').fill('werktags')
    await neu.getByLabel('Für wen').fill('bei Schlafproblemen')
    await neu.getByLabel('Kreis (Hilfe zu einem Thema)').selectOption({ label: 'Kreis: Schlaf' })
    await neu.getByRole('button', { name: 'Hinzufügen' }).click()
    await expect(admin.getByText(`«${name}» hinzugefügt.`)).toBeVisible()
    await reader.reload()
    await expect(reader.getByRole('region', { name: 'Hilfe zu diesem Thema' }).getByText(name)).toBeVisible()
    await expect(reader.locator('aside.side .help')).not.toContainText(name)
    // Aufräumen: Eintrag löschen.
    await admin.reload()
    await admin.getByRole('form', { name, exact: true }).getByRole('button', { name: 'Löschen' }).click()
    await admin.getByRole('dialog').getByRole('button', { name: 'Löschen' }).click()
    await expect(admin.getByText(`«${name}» gelöscht.`)).toBeVisible()
  } finally {
    // Andere Tests erwarten «Schlaf» ohne Pflicht-Hinweis.
    await admin.goto('/admin/kreise')
    if (await toggle.isChecked()) {
      await card.locator('label.switch', { hasText: 'Inhaltshinweis immer an' }).click()
      await card.getByRole('button', { name: 'Speichern' }).click()
      await expect(admin.getByText('Kreis «Schlaf» gespeichert.')).toBeVisible()
    }
  }
})

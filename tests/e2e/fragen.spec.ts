import { expect, test } from '@playwright/test'
import { moderator, register } from './helpers'

const SCHLAF = 'Was tust du, wenn um drei Uhr nachts die Gedanken kreisen?'

test('Fragen vom Team: im Kreis sichtbar, Antwort ist ein eigener Gedanke mit Hinweis auf die Frage', async ({ browser }) => {
  const page = await browser.newPage()
  await register(page)

  // «Alle»: eine Frage des Tages, klar als Team gekennzeichnet.
  await expect(page.locator('.team-prompt:visible')).toHaveCount(1)
  await expect(page.locator('.team-prompt:visible')).toContainText('Frage vom Team Jiaia')
  // Bei jedem Neuladen eine andere Frage – nie zweimal dieselbe hintereinander.
  let before = await page.locator('.team-prompt:visible .team-prompt-q').innerText()
  for (let i = 0; i < 4; i++) {
    await page.reload()
    const now = await page.locator('.team-prompt:visible .team-prompt-q').innerText()
    expect(now).not.toBe(before)
    before = now
  }

  await page.goto('/start?kreis=schlaf')
  const card = page.locator('.team-prompt:visible')
  await expect(card).toContainText('Frage vom Team Jiaia')
  await expect(card.getByRole('button', { name: new RegExp(SCHLAF) })).toBeVisible()
  await expect(card.getByRole('button', { name: /Wie sieht ein guter Abend vor dem Schlafen/ })).toBeVisible()

  // Klick öffnet das Schreibfeld im Kreis der Frage, mit der Frage darüber.
  await expect(async () => {
    await card.getByRole('button', { name: new RegExp(SCHLAF) }).click()
    await expect(page.locator('#composer-text')).toBeVisible({ timeout: 2_000 })
  }).toPass({ timeout: 30_000 })
  const dlg = page.getByRole('dialog')
  await expect(dlg.getByText('Du antwortest auf die Frage vom Team:')).toBeVisible()
  await expect(dlg.getByRole('radiogroup', { name: 'In welchem Kreis?' }).getByRole('radio', { name: 'Schlaf', exact: true })).toHaveAttribute('aria-checked', 'true')

  // Ein anderer Kreis: Die Frage gilt dort nicht – der Hinweis verschwindet.
  await dlg.getByRole('radio', { name: 'Angst', exact: true }).click()
  await expect(dlg.getByText('Du antwortest auf die Frage vom Team:')).toHaveCount(0)
  await dlg.getByRole('radio', { name: 'Schlaf', exact: true }).click()
  await expect(dlg.getByText('Du antwortest auf die Frage vom Team:')).toBeVisible()

  const text = `Ich mache Licht in der Küche und trinke ein Glas Wasser ${Date.now()}`
  await page.locator('#composer-text').fill(text)
  const saved = page.waitForResponse((r) => r.request().method() === 'POST' && r.request().headers()['next-action'] !== undefined)
  await dlg.getByRole('button', { name: 'Teilen', exact: true }).click()
  await saved
  await expect(page.locator('dialog[open]')).toHaveCount(0)

  // Andere sehen den Gedanken mit dem Hinweis auf die Frage.
  const other = await browser.newPage()
  await register(other)
  await other.goto('/start?kreis=schlaf')
  const post = other.locator('article:visible', { hasText: text })
  await expect(post).toBeVisible()
  await expect(post.locator('.post-prompt')).toContainText('Zur Frage vom Team')
  await expect(post.locator('.post-prompt')).toContainText(SCHLAF)

  // «Ohne die Frage teilen» – der Gedanke steht dann ohne Hinweis.
  await expect(async () => {
    await other.locator('.team-prompt:visible').getByRole('button', { name: new RegExp(SCHLAF) }).click()
    await expect(other.locator('#composer-text')).toBeVisible({ timeout: 2_000 })
  }).toPass({ timeout: 30_000 })
  await other.getByRole('button', { name: 'Ohne die Frage teilen' }).click()
  await expect(other.getByText('Du antwortest auf die Frage vom Team:')).toHaveCount(0)
  const free = `Einfach so, ohne Frage ${Date.now()}`
  await other.locator('#composer-text').fill(free)
  const saved2 = other.waitForResponse((r) => r.request().method() === 'POST' && r.request().headers()['next-action'] !== undefined)
  await other.getByRole('dialog').getByRole('button', { name: 'Teilen', exact: true }).click()
  await saved2
  await other.goto('/start?kreis=schlaf')
  await expect(other.locator('article:visible', { hasText: free })).toBeVisible()
  await expect(other.locator('article:visible', { hasText: free }).locator('.post-prompt')).toHaveCount(0)
})

test('Admin: Fragen vom Team anlegen, ausblenden, löschen', async ({ browser }) => {
  const admin = await moderator(browser, 'admin')
  const text = `Testfrage ${Date.now().toString(36)}: Was hat dir heute Mut gemacht?`
  await admin.goto('/admin/fragen')
  const neu = admin.getByRole('form', { name: 'Neue Frage' })
  await neu.getByLabel('Frage', { exact: true }).fill(text)
  await neu.getByLabel('Frage auf Englisch').fill('Test question: what gave you courage today?')
  await neu.getByLabel('Kreis').selectOption({ label: 'Angst' })
  await neu.getByRole('button', { name: 'Hinzufügen' }).click()
  await expect(admin.getByText('Frage hinzugefügt.')).toBeVisible()
  const row = admin.getByRole('form', { name: `Frage: ${text}` })
  await expect(row).toBeVisible()
  await expect(admin.getByRole('region', { name: 'Fragen im Kreis Angst' }).getByRole('form', { name: `Frage: ${text}` })).toBeVisible()

  const member = await browser.newPage()
  await register(member)
  await member.goto('/start?kreis=angst')
  await expect(member.locator('.team-prompt:visible')).toContainText(text)

  // Ausblenden: verschwindet aus dem Kreis.
  await row.locator('label.switch', { hasText: 'Aktiv' }).click()
  await row.getByRole('button', { name: 'Speichern' }).click()
  await expect(admin.getByText('Frage gespeichert.')).toBeVisible()
  await member.goto('/start?kreis=angst')
  await expect(member.locator('.team-prompt:visible')).not.toContainText(text)

  await row.getByRole('button', { name: 'Löschen' }).click()
  await admin.getByRole('dialog').getByRole('button', { name: 'Löschen' }).click()
  await expect(admin.getByText('Frage gelöscht.')).toBeVisible()
  await admin.reload()
  await expect(admin.getByRole('form', { name: `Frage: ${text}` })).toHaveCount(0)
})

import { expect, test } from '@playwright/test'
import { moderator, openComposer, register, share } from './helpers'

test('Admin → Einträge: alle Gedanken sehen, suchen und verwalten – samt Antworten und Konto', async ({ browser }) => {
  const author = await browser.newPage()
  await register(author)
  const text = `Eintrag zum Verwalten ${Date.now()}`
  await share(author, text)

  const other = await browser.newPage()
  await register(other)
  await other.goto('/start')
  const card = other.locator('article:visible', { hasText: text })
  await card.locator('.reply-toggle').click()
  await card.getByRole('button', { name: 'Du bist damit nicht allein.' }).click()
  await card.getByRole('button', { name: 'Antwort senden' }).click()
  await expect(card.locator('.reply')).toContainText('Du bist damit nicht allein.')

  const admin = await moderator(browser, 'mod')
  await admin.goto('/admin')
  await admin.getByRole('link', { name: 'Einträge' }).click()
  await admin.waitForURL('**/admin/eintraege')
  await admin.getByRole('searchbox', { name: 'Im Text suchen' }).fill(text)
  await admin.getByRole('button', { name: 'Anzeigen' }).click()
  await expect(admin.locator('.entries [role="status"]')).toHaveText('1 Gedanke')
  const entry = admin.locator('li.entry', { hasText: text })
  await expect(entry).toBeVisible()
  // Nie der Benutzername – nur die Mitglieds-ID.
  await expect(entry.locator('.top').first()).toContainText(/Mitglied M-[0-9A-F]{4,}/)
  const postForm = entry.getByRole('form', { name: 'Gedanke verwalten' })

  // Ausblenden mit Begründung → für andere weg; wieder zeigen → wieder da.
  await postForm.getByLabel('Begründung (geht an die Person)').fill('Bitte keine Namen.')
  await postForm.getByRole('button', { name: 'Ausblenden' }).click()
  await expect(entry).toContainText('ausgeblendet')
  await expect(entry).toContainText('Begründung beim Ausblenden: «Bitte keine Namen.»')
  await other.goto('/start')
  await expect(other.locator('article:visible', { hasText: text })).toHaveCount(0)
  await postForm.getByRole('button', { name: 'Wieder zeigen' }).click()
  await expect(postForm.getByRole('button', { name: 'Ausblenden' })).toBeVisible()
  await other.goto('/start')
  await expect(other.locator('article:visible', { hasText: text })).toBeVisible()

  // Inhaltshinweis und Antworten schliessen.
  await postForm.getByRole('button', { name: 'Inhaltshinweis an' }).click()
  await expect(entry.locator('.entry-badges')).toContainText('Inhaltshinweis')
  await postForm.getByRole('button', { name: 'Antworten schliessen' }).click()
  await expect(entry.locator('.entry-badges')).toContainText('Antworten geschlossen')
  await postForm.getByRole('button', { name: 'Antworten öffnen' }).click()
  await expect(entry.locator('.entry-badges')).not.toContainText('Antworten geschlossen')

  // Antwort ansehen und löschen (mit Rückfrage).
  await entry.locator('.entry-replies summary').click()
  const replyForm = entry.getByRole('form', { name: 'Antwort verwalten' })
  await expect(entry.locator('.entry-replies')).toContainText('Du bist damit nicht allein.')
  await replyForm.getByRole('button', { name: 'Löschen' }).click()
  await admin.getByRole('dialog').getByRole('button', { name: 'Löschen' }).click()
  await expect(entry.locator('.entry-replies')).toHaveCount(0)

  // Konto der Verfasserin: 24 h stumm – sie kann nur noch lesen.
  await postForm.getByRole('button', { name: '24 h stumm' }).click()
  await expect(admin.getByText('Das ging nicht')).toHaveCount(0)
  await author.goto('/start')
  await openComposer(author)
  await author.locator('#composer-text').fill('Noch ein Gedanke, während ich stumm bin.')
  await author.getByRole('dialog').getByRole('button', { name: 'Teilen', exact: true }).click()
  await expect(author.getByText('Du bist gerade stummgeschaltet und kannst nur lesen.')).toBeVisible()

  // Alle Einträge eines Mitglieds über die Kontoseite.
  await entry.locator('.top .member-link').first().click()
  await admin.waitForURL('**/admin/konto/**')
  await admin.getByRole('link', { name: 'Einträge dieses Mitglieds ansehen' }).click()
  await expect(admin.locator('li.entry', { hasText: text })).toBeVisible()

  // Endgültig löschen.
  const again = admin.locator('li.entry', { hasText: text })
  await again.getByRole('form', { name: 'Gedanke verwalten' }).getByRole('button', { name: 'Löschen' }).click()
  await admin.getByRole('dialog').getByRole('button', { name: 'Löschen' }).click()
  await expect(admin.locator('li.entry', { hasText: text })).toHaveCount(0)
  await other.goto('/start')
  await expect(other.locator('article:visible', { hasText: text })).toHaveCount(0)

  // Im Audit-Log vermerkt.
  await admin.goto('/admin/audit')
  await expect(admin.getByText('Eintrag gelöscht').first()).toBeVisible()
})

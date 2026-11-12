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
  await admin.getByRole('button', { name: 'Anzeigen', exact: true }).click()
  await expect(admin.locator('.entries [role="status"]:visible')).toHaveText('1 Gedanke')
  // Liste: eine Zeile mit Auszug und Mitglieds-ID – nie der Benutzername.
  const row = admin.locator('.entry-row:visible', { hasText: text })
  await expect(row).toBeVisible()
  await expect(row).toContainText(/Mitglied M-[0-9A-F]{4,}/)
  await expect(row).toContainText('1 Antwort')
  const ref = (await row.locator('.entry-row-meta').innerText()).match(/M-[0-9A-F]+/)![0]
  // Erst der Klick öffnet den Eintrag mit allen Massnahmen.
  await expect(admin.getByRole('form', { name: 'Gedanke verwalten' })).toHaveCount(0)
  await row.click()
  await admin.waitForURL(/\/admin\/eintraege\/[0-9a-f-]{36}/)
  const entry = admin.locator('article.entry:visible')
  await expect(entry).toContainText(text)
  await expect(entry.locator('.top').first()).toContainText(`Mitglied ${ref}`)
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

  // Mitglieder: Gedanken und Antworten werden gezählt.
  const members = await admin.context().newPage()
  await members.goto(`/admin/mitglieder?q=${ref.slice(2)}`)
  const memberRow = members.locator('tr', { has: members.getByRole('link', { name: ref, exact: true }) })
  await expect(memberRow.locator('td').nth(5)).toHaveText('1')
  await expect(memberRow.locator('td').nth(6)).toHaveText('0')
  await members.close()

  // Antworten stehen direkt im Eintrag; eine löschen (mit Rückfrage).
  const replies = admin.locator('.entry-replies:visible')
  await expect(replies).toContainText('Du bist damit nicht allein.')
  await replies.getByRole('form', { name: 'Antwort verwalten' }).getByRole('button', { name: 'Löschen' }).click()
  await admin.getByRole('dialog').getByRole('button', { name: 'Löschen' }).click()
  await expect(replies).toContainText('Noch keine Antworten')

  // Konto der Verfasserin: 24 h stumm – sie kann nur noch lesen.
  await postForm.getByRole('button', { name: '24 h stumm' }).click()
  await expect(admin.getByText('Das ging nicht')).toHaveCount(0)
  await author.goto('/start')
  await openComposer(author)
  await author.locator('#composer-text').fill('Noch ein Gedanke, während ich stumm bin.')
  await author.getByRole('dialog').getByRole('button', { name: 'Teilen', exact: true }).click()
  await expect(author.getByText('Du bist gerade stummgeschaltet und kannst nur lesen.')).toBeVisible()

  // Zurück zur Liste (mit Suche), dann alle Einträge des Mitglieds über die Kontoseite.
  await admin.getByRole('link', { name: '← Zur Liste' }).click()
  await expect(admin.getByRole('searchbox', { name: 'Im Text suchen' })).toHaveValue(text)
  await expect(admin.locator('.entry-row:visible')).toHaveCount(1)
  await admin.locator('.entry-row:visible').click()
  await admin.locator('article.entry:visible .top .member-link').first().click()
  await admin.waitForURL('**/admin/konto/**')
  await admin.getByRole('link', { name: 'Einträge dieses Mitglieds ansehen' }).click()
  // Mit Inhaltshinweis steht der Text nicht in der Liste – nur der Hinweis.
  await expect(admin.locator('.entry-row:visible')).toHaveCount(1)
  await expect(admin.locator('.entry-row:visible')).toContainText('Mit Inhaltshinweis – im Eintrag ansehen')
  await expect(admin.locator('.entry-row:visible')).not.toContainText(text)
  await admin.locator('.entry-row:visible').click()

  // Endgültig löschen.
  await admin.locator('article.entry:visible').getByRole('form', { name: 'Gedanke verwalten' }).getByRole('button', { name: 'Löschen' }).click()
  await admin.getByRole('dialog').getByRole('button', { name: 'Löschen' }).click()
  await expect(admin.getByText('Diesen Eintrag gibt es nicht mehr – er wurde gelöscht.')).toBeVisible()
  await other.goto('/start')
  await expect(other.locator('article:visible', { hasText: text })).toHaveCount(0)

  // Im Audit-Log vermerkt.
  await admin.goto('/admin/audit')
  await expect(admin.getByText('Eintrag gelöscht').first()).toBeVisible()
})

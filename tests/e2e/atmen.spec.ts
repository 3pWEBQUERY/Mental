import { expect, test } from '@playwright/test'
import { register } from './helpers'

test('Atemmuster: Box und 4-7-8, Dauer 1/3/5 Minuten – gemerkt und in den Einstellungen', async ({ page }) => {
  await register(page)
  const stage = page.locator('section.stage')
  const pattern = stage.getByRole('radiogroup', { name: 'Atemmuster' })
  const minutes = stage.getByRole('radiogroup', { name: 'Dauer' })
  await expect(pattern.getByRole('radio', { name: '4-2-6' })).toHaveAttribute('aria-checked', 'true')
  await expect(stage.getByRole('button', { name: '1 Minute atmen' })).toBeVisible()

  await pattern.getByRole('radio', { name: 'Box' }).click()
  await minutes.getByRole('radio', { name: '3 Min.' }).click()
  await expect(stage.getByRole('button', { name: '3 Minuten atmen' })).toBeVisible()
  await expect(stage.getByText('Vier gleiche Takte')).toBeVisible()
  if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/atmen-${test.info().project.name}.png` })

  // Starten: Box 4-4-4-4 × 11 Runden = 176 s.
  await stage.getByRole('button', { name: '3 Minuten atmen' }).click()
  await expect(stage.locator('.breath-label b')).toHaveText('Einatmen')
  await expect(stage.locator('.breath-label span')).toContainText(/noch 17\d s/)
  await expect(stage.locator('.breath-options')).toHaveAttribute('inert')
  await expect(stage.locator('.breath-label b')).toHaveText('Halten', { timeout: 6_000 })
  await stage.getByRole('button', { name: 'Beenden' }).click()

  // Gemerkt: nach dem Neuladen und in den Einstellungen.
  await expect.poll(async () => (await page.reload(), await stage.getByRole('button', { name: '3 Minuten atmen' }).count()), { timeout: 8_000 }).toBe(1)
  await expect(stage.getByRole('radiogroup', { name: 'Atemmuster' }).getByRole('radio', { name: 'Box' })).toHaveAttribute('aria-checked', 'true')
  await page.goto('/einstellungen')
  const set = page.getByRole('radiogroup', { name: 'Atemmuster' })
  await expect(set.getByRole('radio', { name: 'Box 4-4-4-4' })).toHaveAttribute('aria-checked', 'true')
  await set.getByRole('radio', { name: '4-7-8' }).click()
  await page.getByRole('radiogroup', { name: 'Dauer der Atemübung' }).getByRole('radio', { name: '5 Min.' }).click()
  await expect(page.getByText('Lange halten, lange aus.')).toBeVisible()
  await expect.poll(async () => (await page.goto('/start'), await stage.getByRole('button', { name: '5 Minuten atmen' }).count()), { timeout: 8_000 }).toBe(1)
  await expect(stage.getByRole('radiogroup', { name: 'Atemmuster' }).getByRole('radio', { name: '4-7-8' })).toHaveAttribute('aria-checked', 'true')
})

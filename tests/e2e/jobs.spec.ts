import { execSync } from 'node:child_process'
import { expect, test } from '@playwright/test'
import { Pool } from 'pg'
import { closeExtraContexts, register, share } from './helpers'

/** Worker-Jobs gegen die echte E2E-Datenbank: Loslassen, Kontolöschung, Aufbewahrung. */
test.afterEach(closeExtraContexts)

const run = (job: string) => execSync(`npx tsx tests/e2e/run-job.ts ${job}`, { stdio: 'pipe', env: process.env })

test('Worker: losgelassene Gedanken, fällige Kontolöschung und Aufbewahrungsfristen', async ({ page }) => {
  const { username } = await register(page)
  const t = Date.now()
  const letGo = `Loslassen ${t}`
  const stays = `Bleibt ${t}`
  await share(page, letGo)
  await share(page, stays)
  await expect(page.locator('article', { hasText: stays })).toBeVisible()
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  try {
    const q = async <T>(sql: string, params: unknown[] = []) => (await pool.query(sql, params)).rows as T[]
    const userId = (await q<{ id: string }>(`SELECT id FROM users WHERE username = $1`, [username]))[0]!.id

    // 1. «Loslassen»: abgelaufener Gedanke wird endgültig geleert, der andere bleibt.
    await q(`UPDATE posts SET expires_at = now() - interval '1 minute' WHERE body = $1`, [letGo])
    run('expirePosts')
    const [gone] = await q<{ body: string; deleted: boolean }>(`SELECT body, deleted_at IS NOT NULL AS deleted FROM posts WHERE user_id = $1 AND expires_at IS NOT NULL`, [userId])
    expect(gone).toEqual({ body: '', deleted: true })
    expect(await q(`SELECT 1 FROM posts WHERE body = $1`, [stays])).toHaveLength(1)

    // 2. Aufbewahrung: alte erledigte Meldung verliert Notiz und meldende Person; alte gelöschte Zeile verschwindet.
    const postId = (await q<{ id: string }>(`SELECT id FROM posts WHERE body = $1`, [stays]))[0]!.id
    await q(
      `INSERT INTO reports (id, reporter_id, target_type, target_id, reason, note, status, priority, created_at, resolved_at)
       VALUES (gen_random_uuid(), $1, 'post', $2, 'other', 'alte Notiz', 'resolved', 2, now() - interval '13 months', now() - interval '13 months')`,
      [userId, postId],
    )
    await q(`UPDATE posts SET deleted_at = now() - interval '31 days' WHERE user_id = $1 AND deleted_at IS NOT NULL`, [userId])
    run('applyRetention')
    const [old] = await q<{ note: string | null; reporter: string | null }>(`SELECT note, reporter_id AS reporter FROM reports WHERE target_id = $1 AND note IS NULL`, [postId])
    expect(old).toEqual({ note: null, reporter: null })
    expect(await q(`SELECT 1 FROM posts WHERE user_id = $1 AND deleted_at IS NOT NULL`, [userId])).toHaveLength(0)

    // 3. Fällige Kontolöschung: Konto weg, Gedanken weg, offene Meldungen zu den Inhalten geschlossen, Name reserviert.
    await q(
      `INSERT INTO reports (id, target_type, target_id, reason, status, priority) VALUES (gen_random_uuid(), 'post', $1, 'hurtful', 'open', 2)`,
      [postId],
    )
    await q(`UPDATE users SET status = 'deleting', delete_after = now() - interval '1 minute' WHERE id = $1`, [userId])
    run('purgeDueAccounts')
    expect(await q(`SELECT 1 FROM users WHERE id = $1`, [userId])).toHaveLength(0)
    expect(await q(`SELECT 1 FROM posts WHERE user_id = $1`, [userId])).toHaveLength(0)
    expect(await q(`SELECT 1 FROM reports WHERE target_id = $1 AND status = 'open'`, [postId])).toHaveLength(0)
    expect(await q(`SELECT 1 FROM reserved_usernames WHERE username = $1`, [username])).toHaveLength(1)
  } finally {
    await pool.end()
  }
})

test('Zuhören, wenn es still bleibt: unbeantworteter Gedanke geht an Zuhörende – einmal, ohne die Autorin', async ({ browser, page }) => {
  // Zuhörende Person schaltet es ein.
  await register(page, 'Zuhörerin')
  await page.goto('/einstellungen')
  const saved = page.waitForResponse((r) => r.request().method() === 'POST' && r.request().headers()['next-action'] !== undefined)
  await page.getByLabel(/Zuhören, wenn es still bleibt/).check()
  await saved

  const author = await (await browser.newContext()).newPage()
  const { username } = await register(author, 'Autorin')
  const body = `Niemand hat geantwortet ${Date.now()}`
  await share(author, body)
  await expect(author.locator('article', { hasText: body })).toBeVisible()

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  try {
    const q = async <T>(sql: string, params: unknown[] = []) => (await pool.query(sql, params)).rows as T[]
    // Andere wartende Gedanken aus früheren Tests nicht mitzählen: nur dieser ist «alt genug».
    await q(`UPDATE posts SET nudged_at = now() WHERE nudged_at IS NULL AND body <> $1`, [body])
    await q(`UPDATE posts SET created_at = now() - interval '7 hours' WHERE body = $1`, [body])
    // Die Autorin hätte es auch eingeschaltet – sie darf trotzdem nicht auf den eigenen Gedanken hingewiesen werden.
    await q(`UPDATE profiles SET settings = settings || '{"listener": true}' WHERE user_id = (SELECT id FROM users WHERE username = $1)`, [username])
    run('nudgeListeners')
    const [post] = await q<{ nudged: boolean }>(`SELECT nudged_at IS NOT NULL AS nudged FROM posts WHERE body = $1`, [body])
    expect(post!.nudged).toBe(true)

    await page.goto('/lichtung')
    await page.getByRole('button', { name: /Benachrichtigungen/ }).click()
    const bell = page.getByRole('dialog', { name: 'Benachrichtigungen' })
    await expect(bell).toContainText('Ein Gedanke wartet seit einigen Stunden')
    // Kein Ausschnitt des Gedankens in der Glocke – nur der Link.
    await expect(bell).not.toContainText(body)
    await bell.getByRole('link', { name: 'Ansehen' }).first().click()
    await expect(page.getByText(body)).toBeVisible()

    await author.goto('/lichtung')
    await author.getByRole('button', { name: /Benachrichtigungen/ }).click()
    await expect(author.getByRole('dialog', { name: 'Benachrichtigungen' })).not.toContainText('Ein Gedanke wartet seit einigen Stunden')

    // Zweiter Lauf: nichts doppelt.
    run('nudgeListeners')
    const n = await q<{ n: number }>(`SELECT count(*)::int AS n FROM notifications WHERE payload->>'message' LIKE 'Ein Gedanke wartet%' AND post_id = (SELECT id FROM posts WHERE body = $1)`, [body])
    expect(n[0]!.n).toBe(1)
  } finally {
    await pool.end()
  }
})

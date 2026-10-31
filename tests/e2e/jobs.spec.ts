import { execSync } from 'node:child_process'
import { expect, test } from '@playwright/test'
import { Pool } from 'pg'
import { register, share } from './helpers'

/** Worker-Jobs gegen die echte E2E-Datenbank: Loslassen, Kontolöschung, Aufbewahrung. */
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

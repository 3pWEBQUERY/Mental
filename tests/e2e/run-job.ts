/** Führt einen Worker-Job einmal gegen die E2E-Datenbank aus (aus jobs.spec.ts per execSync). */
import { pool } from '../../db'
import { purgeDueAccounts } from '../../worker/jobs/account'
import { expirePosts } from '../../worker/jobs/posts'
import { applyRetention } from '../../worker/jobs/retention'

const jobs: Record<string, () => Promise<void>> = { expirePosts, purgeDueAccounts, applyRetention }
const name = process.argv[2]!
const job = jobs[name]
if (!job) throw new Error(`unbekannter Job ${name}`)
await job()
await pool.end()

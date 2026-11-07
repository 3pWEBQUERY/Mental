/** Führt einen Worker-Job einmal gegen die E2E-Datenbank aus (aus jobs.spec.ts per execSync). */
import { pool } from '../../db'
import { purgeDueAccounts } from '../../worker/jobs/account'
import { expirePosts } from '../../worker/jobs/posts'
import { applyRetention } from '../../worker/jobs/retention'
import { nudgeListeners } from '../../worker/jobs/listeners'
import { crisisFollowUp } from '../../worker/jobs/follow-up'

// Nachfrage: die Uhrzeit fest auf 10 Uhr, damit der Test nicht von der Tageszeit abhängt.
const jobs: Record<string, () => Promise<void>> = {
  expirePosts,
  purgeDueAccounts,
  applyRetention,
  nudgeListeners,
  crisisFollowUp: () => crisisFollowUp(new Date('2026-06-01T08:00:00Z')),
}
const name = process.argv[2]!
const job = jobs[name]
if (!job) throw new Error(`unbekannter Job ${name}`)
await job()
// Hat der Job etwas eingereiht (z. B. Push), läuft pg-boss – ohne Stopp endete der Prozess nie (execSync hinge).
const boss = (globalThis as { __lichtungBoss?: Promise<{ stop: (o?: object) => Promise<void> }> }).__lichtungBoss
if (boss) await (await boss).stop({ graceful: false, close: true })
await pool.end()

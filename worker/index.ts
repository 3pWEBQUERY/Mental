/**
 * Worker-Service: verarbeitet die pg-boss-Queue in Postgres.
 * Bildverarbeitung, Moderations-Calls, Push, Export, Löschjobs und Aufräumen.
 */
import { readFileSync } from 'node:fs'
import { sql } from 'drizzle-orm'
import { db, pool } from '../db'
import { workerHeartbeats } from '../db/schema'
import { getBoss, QUEUES, type JobData } from '../lib/jobs'
import { exportAccount, purgeAccount, purgeDueAccounts, purgeInactiveAccounts } from './jobs/account'
import { cleanupExports, cleanupNotifications, cleanupPresence, cleanupRateLimits } from './jobs/cleanup'
import { cleanupQuarantine, processImage, requeueStuckMedia } from './jobs/media'
import { moderateContent } from './jobs/moderation'
import { sendPush } from './jobs/push'

const TZ = 'Europe/Zurich'

/**
 * Migrationen laufen im Pre-Deploy des Web-Service. Der Worker wird parallel ausgerollt und darf
 * neuen Code erst starten, wenn die Datenbank so weit ist – sonst scheitern Jobs an fehlenden Spalten.
 */
async function waitForMigrations() {
  const journal = JSON.parse(readFileSync(new URL('../db/migrations/meta/_journal.json', import.meta.url), 'utf8')) as { entries: unknown[] }
  const expected = journal.entries.length
  for (let i = 0; ; i++) {
    const applied = await db
      .execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations`)
      .then((r) => r.rows[0]?.n ?? 0)
      .catch(() => 0)
    if (applied >= expected) return
    if (i % 6 === 0) console.log(`[worker] warte auf Migrationen (${applied}/${expected}) …`)
    await new Promise((r) => setTimeout(r, 5_000))
  }
}

async function main() {
  await waitForMigrations()
  const boss = await getBoss('worker')

  const each =
    <K extends keyof JobData>(fn: (d: JobData[K]) => Promise<void>) =>
    async (jobs: { name: string; id: string; data: JobData[K] }[]) => {
      for (const job of jobs) {
        try {
          await fn(job.data)
        } catch (e) {
          // pg-boss wiederholt den Job; ohne Log wäre ein Fehler hier unsichtbar.
          console.error(`[${job.name}] ${job.id} fehlgeschlagen:`, (e as Error).message)
          throw e
        }
      }
    }

  // Ein Job pro Abruf, parallel über localConcurrency: Scheitert einer, wird nur er wiederholt –
  // nicht ein ganzer Stapel (sonst gingen z. B. Push-Nachrichten doppelt raus).
  await boss.work(QUEUES.processImage, { localConcurrency: 2 }, each<'process-image'>(processImage))
  await boss.work(QUEUES.moderate, { localConcurrency: 5 }, each<'moderate-content'>(moderateContent))
  await boss.work(QUEUES.push, { localConcurrency: 10 }, each<'send-push'>(sendPush))
  await boss.work(QUEUES.exportAccount, each<'export-account'>(exportAccount))
  await boss.work(QUEUES.purgeAccount, each<'purge-account'>((d) => purgeAccount(d)))

  const cron: [string, string, () => Promise<void>][] = [
    [QUEUES.cleanupQuarantine, '*/15 * * * *', cleanupQuarantine],
    [QUEUES.requeueMedia, '*/10 * * * *', requeueStuckMedia],
    [QUEUES.cleanupRateLimits, '7 * * * *', cleanupRateLimits],
    [QUEUES.cleanupPresence, '*/20 * * * *', cleanupPresence],
    [QUEUES.cleanupExports, '23 * * * *', cleanupExports],
    [QUEUES.cleanupNotifications, '41 3 * * *', cleanupNotifications],
    [QUEUES.purgeDeleted, '17 4 * * *', purgeDueAccounts],
    [QUEUES.purgeInactive, '29 4 * * 0', purgeInactiveAccounts],
  ]
  for (const [name, schedule, fn] of cron) {
    await boss.schedule(name, schedule, null, { tz: TZ })
    await boss.work(name, async () => {
      await fn()
    })
  }

  // Lebenszeichen alle 30 s; /api/health/worker schlägt Alarm, wenn es ausbleibt.
  const instance = process.env.RAILWAY_REPLICA_ID ?? process.env.HOSTNAME ?? 'local'
  const beat = () =>
    db
      .insert(workerHeartbeats)
      .values({ instance })
      .onConflictDoUpdate({ target: workerHeartbeats.instance, set: { seenAt: new Date() } })
      .catch((e) => console.error('[worker] Lebenszeichen fehlgeschlagen:', (e as Error).message))
  await beat()
  const heartbeat = setInterval(() => void beat(), 30_000)

  console.log('[worker] bereit')
  const stop = async () => {
    console.log('[worker] fährt herunter …')
    clearInterval(heartbeat)
    await boss.stop({ graceful: true, timeout: 20_000 })
    await pool.end()
    process.exit(0)
  }
  process.on('SIGTERM', stop)
  process.on('SIGINT', stop)
}

main().catch((e) => {
  console.error('[worker] Start fehlgeschlagen', e)
  process.exit(1)
})

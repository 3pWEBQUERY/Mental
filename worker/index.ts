/**
 * Worker-Service: verarbeitet die pg-boss-Queue in Postgres.
 * Bildverarbeitung, Moderations-Calls, Push, Export, Löschjobs und Aufräumen.
 */
import { pool } from '../db'
import { getBoss, QUEUES, type JobData } from '../lib/jobs'
import { exportAccount, purgeAccount, purgeDueAccounts, purgeInactiveAccounts } from './jobs/account'
import { cleanupExports, cleanupNotifications, cleanupPresence, cleanupRateLimits } from './jobs/cleanup'
import { cleanupQuarantine, processImage } from './jobs/media'
import { moderateContent } from './jobs/moderation'
import { sendPush } from './jobs/push'

const TZ = 'Europe/Zurich'

async function main() {
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

  await boss.work(QUEUES.processImage, { batchSize: 2 }, each<'process-image'>(processImage))
  await boss.work(QUEUES.moderate, { batchSize: 5 }, each<'moderate-content'>(moderateContent))
  await boss.work(QUEUES.push, { batchSize: 10 }, each<'send-push'>(sendPush))
  await boss.work(QUEUES.exportAccount, each<'export-account'>(exportAccount))
  await boss.work(QUEUES.purgeAccount, each<'purge-account'>((d) => purgeAccount(d)))

  const cron: [string, string, () => Promise<void>][] = [
    [QUEUES.cleanupQuarantine, '*/15 * * * *', cleanupQuarantine],
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

  console.log('[worker] bereit')
  const stop = async () => {
    console.log('[worker] fährt herunter …')
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

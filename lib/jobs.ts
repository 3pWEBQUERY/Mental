import { PgBoss } from 'pg-boss'

/** Alle Hintergrundjobs. Der Web-Service legt sie an, der Worker arbeitet sie ab. */
export const QUEUES = {
  processImage: 'process-image',
  moderate: 'moderate-content',
  push: 'send-push',
  exportAccount: 'export-account',
  purgeAccount: 'purge-account',
  // wiederkehrend
  cleanupQuarantine: 'cleanup-quarantine',
  cleanupRateLimits: 'cleanup-rate-limits',
  cleanupNotifications: 'cleanup-notifications',
  cleanupPresence: 'cleanup-presence',
  cleanupExports: 'cleanup-exports',
  purgeDeleted: 'purge-deleted-accounts',
  purgeInactive: 'purge-inactive-accounts',
} as const

export type JobData = {
  'process-image': { mediaId: string }
  'moderate-content': { targetType: 'post' | 'reply'; targetId: string }
  'send-push': { userId: string; postId: string }
  'export-account': { exportId: string }
  'purge-account': { userId: string }
}

declare global {
  var __lichtungBoss: Promise<PgBoss> | undefined
}

/** Der Web-Service legt nur Jobs an; Wartung und Zeitpläne laufen im Worker (role: 'worker'). */
export function getBoss(role: 'web' | 'worker' = 'web'): Promise<PgBoss> {
  globalThis.__lichtungBoss ??= (async () => {
    const boss = new PgBoss({
      connectionString: process.env.DATABASE_URL!,
      schema: 'pgboss',
      max: role === 'web' ? 2 : 6,
      supervise: role === 'worker',
      schedule: role === 'worker',
    })
    boss.on('error', (e) => console.error('[pg-boss]', e.message))
    await boss.start()
    for (const name of Object.values(QUEUES)) await boss.createQueue(name)
    return boss
  })()
  return globalThis.__lichtungBoss
}

export async function enqueue<K extends keyof JobData>(
  name: K,
  data: JobData[K],
  options: { singletonKey?: string; startAfter?: Date | number; priority?: number } = {},
) {
  const boss = await getBoss()
  return boss.send(name, data, { retryLimit: 3, retryBackoff: true, ...options })
}

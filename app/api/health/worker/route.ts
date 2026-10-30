import { desc } from 'drizzle-orm'
import { connection } from 'next/server'
import { db } from '@/db'
import { workerHeartbeats } from '@/db/schema'
import { getBoss, QUEUES } from '@/lib/jobs'

const STALE_S = 180

/**
 * Für eine externe Überwachung (z. B. Uptime-Dienst): 503, wenn der Worker seit 3 Minuten kein
 * Lebenszeichen gegeben hat oder Aufträge liegen bleiben. Bewusst getrennt von /api/health,
 * damit ein ausgefallener Worker nicht die Web-Replikas neu startet.
 */
export async function GET() {
  await connection()
  try {
    const [last] = await db.select({ seenAt: workerHeartbeats.seenAt }).from(workerHeartbeats).orderBy(desc(workerHeartbeats.seenAt)).limit(1)
    const ageS = last ? Math.round((Date.now() - last.seenAt.getTime()) / 1000) : null
    const boss = await getBoss()
    const queues = await boss.getQueues([QUEUES.processImage, QUEUES.moderate, QUEUES.push, QUEUES.exportAccount, QUEUES.purgeAccount])
    const backlog = queues.reduce((n, q) => n + q.readyCount, 0)
    const failed = queues.reduce((n, q) => n + q.failedCount, 0)
    const ok = ageS !== null && ageS < STALE_S
    return Response.json({ ok, workerSeenSecondsAgo: ageS, backlog, failed }, { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return Response.json({ ok: false }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}

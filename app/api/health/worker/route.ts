import { timingSafeEqual } from 'node:crypto'
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
/** Zahlen (Rückstau, Fehler) nur mit HEALTH_TOKEN – öffentlich nur ok/nicht ok, damit Fremde den Betrieb nicht ausspähen. */
function detailed(request: Request) {
  const token = process.env.HEALTH_TOKEN
  if (!token) return false
  const got = request.headers.get('authorization') ?? ''
  const a = Buffer.from(got)
  const b = Buffer.from(`Bearer ${token}`)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function GET(request: Request) {
  await connection()
  try {
    const [last] = await db.select({ seenAt: workerHeartbeats.seenAt }).from(workerHeartbeats).orderBy(desc(workerHeartbeats.seenAt)).limit(1)
    const ageS = last ? Math.round((Date.now() - last.seenAt.getTime()) / 1000) : null
    const boss = await getBoss()
    const queues = await boss.getQueues([QUEUES.processImage, QUEUES.moderate, QUEUES.push, QUEUES.exportAccount, QUEUES.purgeAccount])
    const backlog = queues.reduce((n, q) => n + q.readyCount, 0)
    const failed = queues.reduce((n, q) => n + q.failedCount, 0)
    const ok = ageS !== null && ageS < STALE_S
    const body = detailed(request) ? { ok, workerSeenSecondsAgo: ageS, backlog, failed } : { ok }
    return Response.json(body, { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return Response.json({ ok: false }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}

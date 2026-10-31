/**
 * Überwachung des Workers – läuft als eigener Railway-Cron-Service alle 5 Minuten (README).
 * Unabhängig vom Worker selbst: Fällt er aus, kann er nicht melden, dass er ausgefallen ist.
 *
 * Prüft das Lebenszeichen (worker_heartbeats) und den Stau in den Warteschlangen. Bei einer neuen
 * Störung bekommen alle Admins und Moderator:innen eine Benachrichtigung in der Glocke und – wenn
 * eingeschaltet – eine Push-Nachricht. Pro Störung genau einmal; ist sie vorbei, folgt eine Entwarnung.
 */
import { desc, eq, inArray, sql } from 'drizzle-orm'
import webpush from 'web-push'
import { db, pool } from '../db'
import { monitorIncidents, notifications, pushSubscriptions, users, workerHeartbeats } from '../db/schema'

const STALE_S = 180
const BACKLOG_MAX = 50
/** Gleicher Kanal wie lib/server/notify.ts – weckt offene Glocken (LISTEN/NOTIFY). */
const NOTIFY_CHANNEL = 'lichtung_notify'

type Check = { key: string; down: boolean; alert: string; recovered: string }

async function checks(): Promise<Check[]> {
  const [last] = await db.select({ seenAt: workerHeartbeats.seenAt }).from(workerHeartbeats).orderBy(desc(workerHeartbeats.seenAt)).limit(1)
  const ageS = last ? Math.round((Date.now() - last.seenAt.getTime()) / 1000) : null
  // Bereit liegende Jobs (nicht zeitversetzt) in den Arbeits-Warteschlangen.
  const backlog = await db
    .execute<{ n: number }>(
      sql`SELECT count(*)::int AS n FROM pgboss.job WHERE state IN ('created', 'retry') AND start_after <= now()
          AND name IN ('process-image', 'moderate-content', 'send-push', 'export-account')`,
    )
    .then((r) => r.rows[0]?.n ?? 0)
    .catch(() => 0)
  return [
    {
      key: 'worker-heartbeat',
      down: ageS === null || ageS > STALE_S,
      alert: `Der Hintergrunddienst (Worker) meldet sich seit ${ageS === null ? 'unbekannt langer Zeit' : `${Math.round(ageS / 60)} Minuten`} nicht. Bilder, Moderation und Push werden gerade nicht verarbeitet. Bitte in Railway den Service «worker» prüfen.`,
      recovered: 'Entwarnung: Der Hintergrunddienst (Worker) läuft wieder.',
    },
    {
      key: 'queue-backlog',
      down: backlog > BACKLOG_MAX,
      alert: `In den Warteschlangen warten ${backlog} Aufträge. Der Worker kommt nicht hinterher oder hängt. Bitte in Railway die Logs des Service «worker» prüfen.`,
      recovered: 'Entwarnung: Die Warteschlangen sind wieder abgearbeitet.',
    },
  ]
}

async function tell(message: string) {
  const staff = await db.select({ id: users.id }).from(users).where(inArray(users.role, ['admin', 'mod']))
  if (!staff.length) return
  await db.insert(notifications).values(staff.map((u) => ({ userId: u.id, kind: 'system' as const, postId: null, payload: { message } })))
  for (const u of staff) await db.execute(sql`SELECT pg_notify(${NOTIFY_CHANNEL}, ${u.id})`)

  const pub = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) return
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? 'mailto:kontakt@lichtung.ch', pub, priv)
  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(inArray(pushSubscriptions.userId, staff.map((u) => u.id)))
  const payload = JSON.stringify({ title: 'Lichtung · Betrieb', body: message.split('.')[0], url: '/lichtung' })
  for (const s of subs) {
    await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload, { TTL: 60 * 60, urgency: 'high' }).catch(async (e) => {
      const status = (e as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, s.id))
    })
  }
}

async function main() {
  for (const c of await checks()) {
    const [open] = await db.select().from(monitorIncidents).where(eq(monitorIncidents.key, c.key))
    if (c.down && !open) {
      console.warn(`[monitor] Störung: ${c.key}`)
      await db.insert(monitorIncidents).values({ key: c.key }).onConflictDoNothing()
      await tell(c.alert)
    } else if (!c.down && open) {
      console.log(`[monitor] behoben: ${c.key}`)
      await db.delete(monitorIncidents).where(eq(monitorIncidents.key, c.key))
      await tell(c.recovered)
    } else {
      console.log(`[monitor] ${c.key}: ${c.down ? 'weiterhin gestört (bereits gemeldet)' : 'ok'}`)
    }
  }
}

main()
  .catch((e) => {
    console.error('[monitor] fehlgeschlagen:', (e as Error).message)
    process.exitCode = 1
  })
  .finally(() => pool.end())

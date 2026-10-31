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
import { isPushEndpoint } from '../lib/push-endpoint'
import { monitorIncidents, notifications, pushSubscriptions, users, workerHeartbeats } from '../db/schema'
import { safeMessage } from '../lib/log-safe'
import { moderationAway, nightStaffed } from '../lib/moderation-hours'

const STALE_S = 180
const BACKLOG_MAX = 50
/** Frist für akute Krisen-Hinweise (Minuten) – danach erinnert der Monitor das Team. */
const ACUTE_SLA_MIN = 30
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
  // Akute Krisen-Hinweise, die seit über 30 Minuten niemand angesehen hat.
  const acuteWaiting = await db
    .execute<{ n: number }>(
      sql`SELECT count(*)::int AS n FROM reports WHERE status = 'open' AND priority = 0 AND created_at < now() - interval '${sql.raw(String(ACUTE_SLA_MIN))} minutes'`,
    )
    .then((r) => r.rows[0]?.n ?? 0)
    .catch(() => 0)
  return [
    {
      key: 'acute-waiting',
      down: acuteWaiting > 0,
      alert: `${acuteWaiting === 1 ? 'Ein akuter Krisen-Hinweis wartet' : `${acuteWaiting} akute Krisen-Hinweise warten`} seit über ${ACUTE_SLA_MIN} Minuten. Bitte jetzt die Warteschlange öffnen – oder jemanden aus dem Team erreichen.`,
      recovered: 'Entwarnung: Alle akuten Krisen-Hinweise sind angesehen.',
    },
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

async function tell(message: string, url = '/start') {
  const staff = await db.select({ id: users.id }).from(users).where(inArray(users.role, ['admin', 'mod']))
  if (!staff.length) return
  await db.insert(notifications).values(staff.map((u) => ({ userId: u.id, kind: 'system' as const, postId: null, payload: { message } })))
  for (const u of staff) await db.execute(sql`SELECT pg_notify(${NOTIFY_CHANNEL}, ${u.id})`)

  const pub = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) return
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? 'mailto:kontakt@jiaia.app', pub, priv)
  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(inArray(pushSubscriptions.userId, staff.map((u) => u.id)))
  const payload = JSON.stringify({ title: 'Jiaia · Betrieb', body: message.split('.')[0], url })
  for (const s of subs) {
    if (!isPushEndpoint(s.endpoint)) continue
    await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload, { TTL: 60 * 60, urgency: 'high' }).catch(async (e) => {
      const status = (e as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, s.id))
    })
  }
}

async function main() {
  // Nachts ohne Bereitschaft: akute Hinweise nicht prüfen (niemand kann reagieren). Um 7 Uhr meldet der erste Lauf,
  // was noch wartet – und eine schon offene Meldung bleibt offen, statt fälschlich «Entwarnung» zu geben.
  const away = moderationAway(nightStaffed())
  for (const c of await checks()) {
    if (away && c.key === 'acute-waiting') continue
    const [open] = await db.select().from(monitorIncidents).where(eq(monitorIncidents.key, c.key))
    if (c.down && !open) {
      console.warn(`[monitor] Störung: ${c.key}`)
      await db.insert(monitorIncidents).values({ key: c.key }).onConflictDoNothing()
      await tell(c.alert, c.key === 'acute-waiting' ? '/admin' : undefined)
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
    console.error('[monitor] fehlgeschlagen:', safeMessage(e))
    process.exitCode = 1
  })
  .finally(() => pool.end())

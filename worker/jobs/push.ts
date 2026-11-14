import { eq } from 'drizzle-orm'
import webpush from 'web-push'
import { localesOf } from '../../lib/recipient-locale'
import { getMessages } from '../../messages'
import { db } from '../../db'
import { apnsDevices, profiles, pushSubscriptions } from '../../db/schema'
import { apnsConfig, sendApns } from '../../lib/apns'
import { isPushEndpoint } from '../../lib/push-endpoint'
import { inQuietHours } from '../../lib/quiet-hours'
import { zurichHour } from '../../lib/time'
import { safeMessage } from '../../lib/log-safe'

let configured = false
function configure() {
  if (configured) return true
  const pub = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) return false
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? 'mailto:team@jiaia.invalid', pub, priv)
  configured = true
  return true
}

/**
 * Nur für «neue Antwort», nur nach Zustimmung, nie in den Ruhezeiten.
 * Der Text ist neutral – auf dem Sperrbildschirm erscheint nichts Persönliches.
 * Geht an den Browser (Web-Push) und an die iOS-App (APNs), je nachdem, was eingerichtet ist.
 */
export async function sendPush({ userId, postId, alert, followUp }: { userId: string; postId?: string; alert?: boolean; followUp?: boolean }) {
  const web = configure()
  const apns = apnsConfig() !== null
  if (!web && !apns) return
  const [subs, devices] = await Promise.all([
    web ? db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId)) : [],
    apns ? db.select().from(apnsDevices).where(eq(apnsDevices.userId, userId)) : [],
  ])
  if (!subs.length && !devices.length) return
  const hour = zurichHour()
  // Neutral und in der Sprache der empfangenden Person.
  const t = getMessages((await localesOf([userId])).get(userId))
  // Diskret-Modus: Auf dem Sperrbildschirm steht weder «Jiaia» noch, dass jemand geantwortet hat.
  const [p] = await db.select({ settings: profiles.settings }).from(profiles).where(eq(profiles.userId, userId))
  const discreet = Boolean(p?.settings?.discreet)
  const message = alert
    ? { title: t.push.acuteTitle, body: t.push.acuteBody, url: '/admin', tag: 'lichtung-acute' }
    : discreet
      ? { title: t.push.discreetTitle, body: t.push.discreetBody, url: followUp ? '/start' : `/start/gedanke/${postId}` }
      : followUp
        ? { title: 'Jiaia', body: t.push.followUp, url: '/start', tag: 'lichtung-follow-up' }
        : { title: 'Jiaia', body: t.push.reply, url: `/start/gedanke/${postId}` }
  const payload = JSON.stringify(message)
  const ttl = alert ? 60 * 60 : 60 * 60 * 12
  for (const d of devices) {
    if (!alert && inQuietHours(hour, d.quietFrom, d.quietTo)) continue
    // Im Diskret-Modus keine Gruppierung nach Gedanken – auch das verriete etwas.
    const thread = discreet ? undefined : (message.tag ?? (postId ? `post-${postId}` : undefined))
    const r = await sendApns(d.token, d.sandbox, { title: message.title, body: message.body, url: message.url, thread, urgent: alert, ttl })
    if (r === 'gone') await db.delete(apnsDevices).where(eq(apnsDevices.id, d.id))
  }
  for (const s of subs) {
    // Ältere Abos von vor der Prüfung: nur an echte Push-Dienste senden, alles andere entfernen.
    if (!isPushEndpoint(s.endpoint)) {
      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, s.id))
      continue
    }
    // Akute Krisen-Hinweise an die Moderation kommen auch in den Ruhezeiten – dafür sind sie da.
    if (!alert && inQuietHours(hour, s.quietFrom, s.quietTo)) continue
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload, alert ? { TTL: 60 * 60, urgency: 'high' } : { TTL: 60 * 60 * 12, urgency: 'normal' })
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, s.id))
      else console.error('[push]', status, safeMessage(e))
    }
  }
}

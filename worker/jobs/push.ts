import { eq } from 'drizzle-orm'
import webpush from 'web-push'
import { db } from '../../db'
import { pushSubscriptions } from '../../db/schema'
import { isPushEndpoint } from '../../lib/push-endpoint'
import { inQuietHours } from '../../lib/quiet-hours'
import { zurichHour } from '../../lib/time'

let configured = false
function configure() {
  if (configured) return true
  const pub = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) return false
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? 'mailto:team@lichtung.invalid', pub, priv)
  configured = true
  return true
}

/**
 * Nur für «neue Antwort», nur nach Zustimmung, nie in den Ruhezeiten.
 * Der Text ist neutral – auf dem Sperrbildschirm erscheint nichts Persönliches.
 */
export async function sendPush({ userId, postId, alert }: { userId: string; postId?: string; alert?: boolean }) {
  if (!configure()) return
  const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId))
  const hour = zurichHour()
  const payload = alert
    ? JSON.stringify({ title: 'Lichtung · Moderation', body: 'Ein akuter Hinweis wartet.', url: '/admin', tag: 'lichtung-acute' })
    : JSON.stringify({ title: 'Lichtung', body: 'Jemand hat dir geantwortet', url: `/lichtung/gedanke/${postId}` })
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
      else console.error('[push]', status, (e as Error).message)
    }
  }
}

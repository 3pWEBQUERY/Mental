import { eq } from 'drizzle-orm'
import webpush from 'web-push'
import { db } from '../../db'
import { pushSubscriptions } from '../../db/schema'
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
export async function sendPush({ userId, postId }: { userId: string; postId: string }) {
  if (!configure()) return
  const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId))
  const hour = zurichHour()
  const payload = JSON.stringify({ title: 'Lichtung', body: 'Jemand hat dir geantwortet', url: `/lichtung/gedanke/${postId}` })
  for (const s of subs) {
    if (inQuietHours(hour, s.quietFrom, s.quietTo)) continue
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload, { TTL: 60 * 60 * 12, urgency: 'normal' })
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, s.id))
      else console.error('[push]', status, (e as Error).message)
    }
  }
}

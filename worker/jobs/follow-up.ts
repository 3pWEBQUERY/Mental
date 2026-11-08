import { sql } from 'drizzle-orm'
import { db } from '../../db'
import { notifications } from '../../db/schema'
import { enqueue, QUEUES } from '../../lib/jobs'
import { safeMessage } from '../../lib/log-safe'
import { zurichHour } from '../../lib/time'
import { localesOf } from '../../lib/recipient-locale'
import { getMessages } from '../../messages'

/** Gleicher Kanal wie lib/server/notify.ts – weckt offene Glocken über alle Replikas. */
const NOTIFY_CHANNEL = 'lichtung_notify'
/** Nur tagsüber fragen – nachts weckt eine Nachfrage niemanden auf. */
export const FOLLOW_UP_HOURS = { from: 9, to: 20 }

/**
 * «Wie geht es dir heute?»: Am Tag nach einem akuten Krisen-Treffer (Gedanke oder Antwort) bekommt die Person eine
 * ruhige Nachricht in die Glocke – mit dem Weg zu den Hilfe-Nummern und zum eigenen Notfallplan, ohne den Inhalt zu
 * zitieren. Frühestens 16 Stunden danach (also am nächsten Tag), nur tagsüber, je schwerem Moment einmal und
 * höchstens alle 3 Tage. Abschaltbar unter Einstellungen → Benachrichtigungen.
 * Push nur, wenn eingeschaltet, mit neutralem Text (Sperrbildschirm) und unter Beachtung der Ruhezeiten.
 */
export async function crisisFollowUp(now = new Date()) {
  const h = zurichHour(now)
  if (h < FOLLOW_UP_HOURS.from || h >= FOLLOW_UP_HOURS.to) return
  const due = await db
    .execute<{ user_id: string }>(sql`
      SELECT c.user_id FROM (
        SELECT user_id, created_at FROM posts
          WHERE crisis_level = 'acute' AND created_at BETWEEN now() - interval '72 hours' AND now() - interval '16 hours'
        UNION ALL
        SELECT user_id, created_at FROM replies
          WHERE crisis_level = 'acute' AND user_id IS NOT NULL AND created_at BETWEEN now() - interval '72 hours' AND now() - interval '16 hours'
      ) c
      JOIN users u ON u.id = c.user_id
      JOIN profiles p ON p.user_id = c.user_id
      WHERE u.status IN ('active', 'muted')
        AND coalesce(p.settings->>'followUp', 'true') <> 'false'
        AND (p.follow_up_at IS NULL OR (p.follow_up_at < c.created_at AND p.follow_up_at < now() - interval '3 days'))
      GROUP BY c.user_id
      LIMIT 200`)
    .then((r) => r.rows)
  let sent = 0
  for (const { user_id: userId } of due) {
    try {
      const claimed = await db.transaction(async (tx) => {
        // Beanspruchen: Läuft der Job doppelt (zwei Worker, Nachholen), fragt nur einer.
        const rows = await tx.execute(sql`
          UPDATE profiles SET follow_up_at = now()
          WHERE user_id = ${userId} AND (follow_up_at IS NULL OR follow_up_at < now() - interval '1 hour')
          RETURNING user_id`)
        if (!rows.rows.length) return false
        const t = getMessages((await localesOf([userId])).get(userId))
        await tx.insert(notifications).values({ userId, kind: 'system', postId: null, payload: { message: t.followUp.message, followUp: true } })
        await tx.execute(sql`SELECT pg_notify(${NOTIFY_CHANNEL}, ${userId})`)
        return true
      })
      if (!claimed) continue
      sent++
      await enqueue(QUEUES.push, { userId, followUp: true }).catch((e) => console.error('[follow-up] Push', safeMessage(e)))
    } catch (e) {
      console.error('[follow-up] fehlgeschlagen:', safeMessage(e))
    }
  }
  if (sent) console.log(`[follow-up] ${sent} Nachfragen gesendet`)
}

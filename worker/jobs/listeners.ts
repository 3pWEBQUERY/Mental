import { inArray, sql } from 'drizzle-orm'
import { db } from '../../db'
import { notifications, profiles } from '../../db/schema'
import { m } from '../../messages'
import { safeMessage } from '../../lib/log-safe'

/** Gleicher Kanal wie lib/server/notify.ts – weckt offene Glocken über alle Replikas. */
const NOTIFY_CHANNEL = 'lichtung_notify'
/** Höchstens so viele Zuhörende pro Gedanke – genug, dass jemand antwortet, zu wenig für einen Ansturm. */
export const LISTENERS_PER_POST = 3

/**
 * «Zuhören, wenn es still bleibt»: Gedanken, die seit 6 Stunden ohne Antwort sind, an bis zu drei Personen
 * melden, die das in den Einstellungen eingeschaltet haben. Jede Person höchstens einmal am Tag, jeder Gedanke
 * höchstens einmal. Nur in der Glocke, nie als Push und nie mit dem Text des Gedankens (der steht im Feed).
 * Wer blockiert, ausgeblendet oder den Kreis stummgeschaltet hat, wird nicht gefragt – in beide Richtungen.
 */
export async function nudgeListeners() {
  let posts = 0
  let people = 0
  const due = await db
    .execute<{ id: string; user_id: string; circle_id: string }>(sql`
      SELECT id, user_id, circle_id FROM posts
      WHERE status = 'visible' AND deleted_at IS NULL AND reply_count = 0 AND nudged_at IS NULL AND NOT closed
        AND created_at BETWEEN now() - interval '24 hours' AND now() - interval '6 hours'
      ORDER BY created_at
      LIMIT 50`)
    .then((r) => r.rows)
  for (const post of due) {
    try {
      const n = await db.transaction(async (tx) => {
        // Den Gedanken für sich beanspruchen – läuft der Job doppelt, fragt nur einer.
        const claimed = await tx.execute(sql`UPDATE posts SET nudged_at = now() WHERE id = ${post.id} AND nudged_at IS NULL RETURNING id`)
        if (!claimed.rows.length) return 0
        const listeners = await tx
          .execute<{ user_id: string }>(sql`
            SELECT pr.user_id FROM profiles pr JOIN users u ON u.id = pr.user_id
            WHERE pr.settings->>'listener' = 'true'
              AND u.status = 'active' AND pr.user_id <> ${post.user_id}
              AND (pr.listener_nudged_at IS NULL OR pr.listener_nudged_at < now() - interval '24 hours')
              AND EXISTS (SELECT 1 FROM sessions s WHERE s.user_id = pr.user_id AND s.expires_at > now())
              AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = pr.user_id AND b.blocked_id = ${post.user_id})
                                                      OR (b.blocker_id = ${post.user_id} AND b.blocked_id = pr.user_id))
              AND NOT EXISTS (SELECT 1 FROM post_hides h WHERE h.user_id = pr.user_id AND h.post_id = ${post.id})
              AND NOT EXISTS (SELECT 1 FROM circle_prefs c WHERE c.user_id = pr.user_id AND c.circle_id = ${post.circle_id} AND c.state = 'mute')
            ORDER BY random()
            LIMIT ${LISTENERS_PER_POST}
            FOR UPDATE OF pr SKIP LOCKED`)
          .then((r) => r.rows)
        if (!listeners.length) return 0
        const ids = listeners.map((l) => l.user_id)
        await tx.update(profiles).set({ listenerNudgedAt: new Date() }).where(inArray(profiles.userId, ids))
        await tx
          .insert(notifications)
          .values(ids.map((userId) => ({ userId, kind: 'system' as const, postId: post.id, payload: { message: m.listener.nudge } })))
        // pg_notify in der Transaktion wird erst beim Commit zugestellt – die Glocke sieht dann schon die Zeile.
        for (const id of ids) await tx.execute(sql`SELECT pg_notify(${NOTIFY_CHANNEL}, ${id})`)
        return ids.length
      })
      if (n) {
        posts++
        people += n
      }
    } catch (e) {
      console.error(`[listeners] ${post.id} fehlgeschlagen:`, safeMessage(e))
    }
  }
  if (posts) console.log(`[listeners] ${posts} Gedanken an ${people} Zuhörende gemeldet`)
}

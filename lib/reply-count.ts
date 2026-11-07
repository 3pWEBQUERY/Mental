import { inArray, sql } from 'drizzle-orm'
import { db } from '../db'
import { posts, replies } from '../db/schema'

type Tx = Pick<typeof db, 'update'>

/**
 * reply_count = sichtbare Antworten anderer Menschen. Wird nach jeder Statusänderung einer Antwort
 * neu gezählt statt hoch- und runtergezählt: So kann der Wert nicht driften, und «Braucht Zuspruch»
 * zeigt einen Gedanken wieder, wenn seine einzige Antwort ausgeblendet oder gelöscht wurde.
 */
export async function syncReplyCount(postIds: string | string[], tx: Tx = db) {
  const ids = [...new Set(Array.isArray(postIds) ? postIds : [postIds])]
  if (!ids.length) return
  await tx
    .update(posts)
    .set({
      // Antworten von Konten in Löschung sind unsichtbar (lib/server/posts.ts) – also auch nicht mitgezählt.
      // Antworten blockierter Konten sieht die Verfasserin nicht – sie zählen bei Gedanken unter Namen nicht als
      // «gehört». Bei anonymen Gedanken nie: Sonst verriete «Braucht Zuspruch» über Blockierungen, wer sie schrieb.
      replyCount: sql`(SELECT count(*)::int FROM replies r WHERE r.post_id = ${posts.id} AND r.status = 'visible' AND NOT r.is_author AND r.deleted_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = r.user_id AND u.status = 'deleting')
        AND (${posts.visibility} = 'anonymous'
          OR NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = ${posts.userId} AND b.blocked_id = r.user_id) OR (b.blocker_id = r.user_id AND b.blocked_id = ${posts.userId}))))`,
    })
    .where(inArray(posts.id, ids))
}

/** Nach Blockieren oder Aufheben: die Gedanken beider Seiten, auf die die andere geantwortet hat, neu zählen. */
export async function syncReplyCountsBetween(a: string, b: string) {
  const rows = await db
    .selectDistinct({ postId: replies.postId })
    .from(replies)
    .innerJoin(posts, sql`${posts.id} = ${replies.postId}`)
    // Nur Gedanken unter Namen: Anonyme zählen Blockierungen nie (siehe syncReplyCount).
    .where(sql`${posts.visibility} = 'pseudonym' AND ((${replies.userId} = ${a} AND ${posts.userId} = ${b}) OR (${replies.userId} = ${b} AND ${posts.userId} = ${a}))`)
  await syncReplyCount(rows.map((r) => r.postId))
}

/** Nach «Konto löschen» und nach dem Abbrechen der Löschung: alle Gedanken neu zählen, auf die das Konto geantwortet hat. */
export async function syncReplyCountsOfAuthor(userId: string) {
  const rows = await db.selectDistinct({ postId: replies.postId }).from(replies).where(sql`${replies.userId} = ${userId}`)
  await syncReplyCount(rows.map((r) => r.postId))
}

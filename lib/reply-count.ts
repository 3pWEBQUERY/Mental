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
      replyCount: sql`(SELECT count(*)::int FROM replies r WHERE r.post_id = ${posts.id} AND r.status = 'visible' AND NOT r.is_author AND r.deleted_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = r.user_id AND u.status = 'deleting'))`,
    })
    .where(inArray(posts.id, ids))
}

/** Nach «Konto löschen» und nach dem Abbrechen der Löschung: alle Gedanken neu zählen, auf die das Konto geantwortet hat. */
export async function syncReplyCountsOfAuthor(userId: string) {
  const rows = await db.selectDistinct({ postId: replies.postId }).from(replies).where(sql`${replies.userId} = ${userId}`)
  await syncReplyCount(rows.map((r) => r.postId))
}

import { inArray, sql } from 'drizzle-orm'
import { db } from '../db'
import { posts } from '../db/schema'

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
      replyCount: sql`(SELECT count(*)::int FROM replies r WHERE r.post_id = ${posts.id} AND r.status = 'visible' AND NOT r.is_author AND r.deleted_at IS NULL)`,
    })
    .where(inArray(posts.id, ids))
}

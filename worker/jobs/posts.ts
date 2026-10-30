import { and, isNotNull, isNull, lt } from 'drizzle-orm'
import { db } from '../../db'
import { posts } from '../../db/schema'
import { hardDeletePost } from '../../lib/post-delete'

/** «Gedanke loslassen»: abgelaufene Gedanken endgültig löschen – wie über den «Löschen»-Knopf. */
export async function expirePosts() {
  const due = await db
    .select({ id: posts.id })
    .from(posts)
    .where(and(isNotNull(posts.expiresAt), lt(posts.expiresAt, new Date()), isNull(posts.deletedAt)))
    .limit(500)
  let n = 0
  for (const { id } of due) {
    if (await hardDeletePost(id).catch((e) => (console.error(`[expire] ${id} fehlgeschlagen:`, (e as Error).message), false))) n++
  }
  if (n) console.log(`[expire] ${n} Gedanken losgelassen`)
}

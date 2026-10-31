import { and, eq, inArray, isNull, or } from 'drizzle-orm'
import { db } from '../db'
import { notifications, postMedia, posts, replies, reports, support } from '../db/schema'
import { journalDeletion } from './deletion-journal'
import { mediaKeys } from './media'
import { bucketConfigured, deleteObject } from './s3'

/**
 * Löscht einen Gedanken endgültig: Text, Antworten, Zuspruch, Bild, Benachrichtigungs-Auszüge.
 * Offene Meldungen dazu werden geschlossen. Genutzt vom «Löschen»-Knopf und vom Worker («loslassen»).
 * `ownerId` begrenzt auf eigene Gedanken; ohne (Worker) zählt nur die ID.
 */
export async function hardDeletePost(id: string, ownerId?: string): Promise<boolean> {
  const media = await db.select({ id: postMedia.id }).from(postMedia).where(eq(postMedia.postId, id))
  const done = await db.transaction(async (tx) => {
    const res = await tx
      .update(posts)
      .set({ body: '', deletedAt: new Date(), status: 'removed', authorHandle: 'Anonym' })
      .where(and(eq(posts.id, id), isNull(posts.deletedAt), ...(ownerId ? [eq(posts.userId, ownerId)] : [])))
      .returning({ id: posts.id })
    if (!res.length) return false
    const replyIds = (await tx.select({ id: replies.id }).from(replies).where(eq(replies.postId, id))).map((r) => r.id)
    await tx.delete(replies).where(eq(replies.postId, id))
    await tx.delete(support).where(eq(support.postId, id))
    await tx.delete(postMedia).where(eq(postMedia.postId, id))
    // «Sofort und endgültig»: auch Auszüge in Benachrichtigungen verschwinden.
    await tx.delete(notifications).where(eq(notifications.postId, id))
    // Offene Meldungen zu gelöschten Inhalten wären in der Warteschlange unsichtbar und blieben ewig offen.
    await tx
      .update(reports)
      .set({ status: 'dismissed', resolvedAt: new Date() })
      .where(
        and(
          eq(reports.status, 'open'),
          or(
            and(eq(reports.targetType, 'post'), eq(reports.targetId, id)),
            ...(replyIds.length ? [and(eq(reports.targetType, 'reply'), inArray(reports.targetId, replyIds))] : []),
          ),
        ),
      )
    return true
  })
  if (done) await journalDeletion('post', id)
  if (done && bucketConfigured()) {
    for (const r of media) for (const k of mediaKeys(r.id)) await deleteObject(k).catch(() => {})
  }
  return done
}

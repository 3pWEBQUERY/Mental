import { and, eq, gt, isNotNull, isNull, lt } from 'drizzle-orm'
import { db } from '../../db'
import { postMedia } from '../../db/schema'
import { enqueue, QUEUES } from '../../lib/jobs'
import { processMedia } from '../../lib/media'
import { deleteObject } from '../../lib/s3'

export async function processImage({ mediaId }: { mediaId: string }) {
  console.log(`[media] ${mediaId} wird bereinigt`)
  const result = await processMedia(mediaId, 'review')
  if (result === 'review') console.log(`[media] ${mediaId} bereinigt – wartet auf Freigabe`)
  else if (result === 'skipped') console.log(`[media] ${mediaId} übersprungen (nicht mehr in Quarantäne)`)
}

/**
 * Quarantäne-Dateien, die nach 1 Stunde noch keinem Gedanken gehören (abgebrochenes Teilen), werden gelöscht.
 * Bilder an einem Gedanken bleiben liegen, bis die Moderation sie freigibt oder ablehnt.
 */
export async function cleanupQuarantine() {
  const old = await db
    .select({ id: postMedia.id, key: postMedia.bucketKey })
    .from(postMedia)
    .where(and(eq(postMedia.status, 'quarantine'), isNull(postMedia.postId), lt(postMedia.createdAt, new Date(Date.now() - 60 * 60 * 1000))))
  for (const r of old) {
    await deleteObject(r.key).catch(() => {})
    await db.delete(postMedia).where(eq(postMedia.id, r.id))
  }
  if (old.length) console.log(`[media] ${old.length} Quarantäne-Dateien entfernt`)
}

/**
 * Netz für verlorene Aufträge: Bilder an einem Gedanken, die nach 10 Minuten noch in der Quarantäne liegen,
 * werden erneut eingereiht – bis 6 Stunden lang. Danach bleiben sie für die Moderation («Jetzt bereinigen»).
 */
export async function requeueStuckMedia() {
  const now = Date.now()
  const stuck = await db
    .select({ id: postMedia.id })
    .from(postMedia)
    .where(
      and(
        eq(postMedia.status, 'quarantine'),
        isNotNull(postMedia.postId),
        lt(postMedia.createdAt, new Date(now - 10 * 60_000)),
        gt(postMedia.createdAt, new Date(now - 6 * 60 * 60_000)),
      ),
    )
  for (const r of stuck) await enqueue(QUEUES.processImage, { mediaId: r.id })
  if (stuck.length) console.log(`[media] ${stuck.length} hängende Bilder erneut eingereiht`)
}

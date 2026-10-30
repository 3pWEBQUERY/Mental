import { encode } from 'blurhash'
import { and, eq, lt } from 'drizzle-orm'
import sharp from 'sharp'
import { db } from '../../db'
import { postMedia } from '../../db/schema'
import { LIMITS } from '../../lib/constants'
import { sniffImage } from '../../lib/image-sniff'
import { deleteObject, getObjectBytes, putObject } from '../../lib/s3'

/**
 * Optionale Bildprüfung durch einen Anbieter (EU/CH). Ohne Konfiguration wird nur technisch geprüft;
 * das Bild erscheint dann erst nach der Neu-Kodierung.
 */
async function imageAllowed(webp: Buffer): Promise<boolean> {
  const url = process.env.MODERATION_IMAGE_API_URL
  if (!url) return true
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'image/webp', authorization: `Bearer ${process.env.MODERATION_API_KEY ?? ''}` },
    body: new Uint8Array(webp),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`Bildprüfung HTTP ${res.status}`)
  const data = (await res.json()) as { allowed?: boolean }
  return data.allowed !== false
}

export async function processImage({ mediaId }: { mediaId: string }) {
  const [row] = await db.select().from(postMedia).where(eq(postMedia.id, mediaId))
  if (!row || row.status !== 'quarantine') return
  const quarantineKey = row.bucketKey
  const reject = async (why: string) => {
    console.warn(`[media] ${mediaId} abgelehnt: ${why}`)
    await db.update(postMedia).set({ status: 'rejected' }).where(eq(postMedia.id, mediaId))
    await deleteObject(quarantineKey).catch(() => {})
  }

  let input: Uint8Array
  try {
    input = await getObjectBytes(quarantineKey)
  } catch {
    return reject('Datei fehlt im Bucket')
  }
  if (input.byteLength > LIMITS.imageMaxBytes) return reject('zu gross')
  if (!sniffImage(input)) return reject('kein JPEG/PNG/WebP')

  try {
    // rotate() übernimmt die EXIF-Ausrichtung; sharp schreibt ohne withMetadata() keine Metadaten (EXIF, GPS, Kamera).
    const base = sharp(input, { failOn: 'error', limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: LIMITS.imageMaxPx, height: LIMITS.imageMaxPx, fit: 'inside', withoutEnlargement: true })
    const webp = await base.clone().webp({ quality: 80 }).toBuffer({ resolveWithObject: true })
    const avif = await base.clone().avif({ quality: 50 }).toBuffer()
    if (!(await imageAllowed(webp.data))) return reject('Inhaltsprüfung')

    const { data: px, info } = await sharp(webp.data).resize(32, 32, { fit: 'inside' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const blurhash = encode(new Uint8ClampedArray(px), info.width, info.height, 4, 3)

    const key = `media/${mediaId}.webp`
    await putObject(key, webp.data, 'image/webp')
    await putObject(`media/${mediaId}.avif`, avif, 'image/avif')
    await db
      .update(postMedia)
      .set({ status: 'ready', bucketKey: key, width: webp.info.width, height: webp.info.height, blurhash, contentType: 'image/webp', size: webp.data.byteLength })
      .where(eq(postMedia.id, mediaId))
    await deleteObject(quarantineKey).catch(() => {})
  } catch (e) {
    return reject((e as Error).message)
  }
}

/** Quarantäne-Dateien, die älter als 1 Stunde sind, werden gelöscht. */
export async function cleanupQuarantine() {
  const old = await db
    .select({ id: postMedia.id, key: postMedia.bucketKey })
    .from(postMedia)
    .where(and(eq(postMedia.status, 'quarantine'), lt(postMedia.createdAt, new Date(Date.now() - 60 * 60 * 1000))))
  for (const r of old) {
    await deleteObject(r.key).catch(() => {})
    await db.delete(postMedia).where(eq(postMedia.id, r.id))
  }
  if (old.length) console.log(`[media] ${old.length} Quarantäne-Dateien entfernt`)
}

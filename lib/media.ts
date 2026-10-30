import { encode } from 'blurhash'
import { eq } from 'drizzle-orm'
import sharp from 'sharp'
import { db } from '../db'
import { postMedia } from '../db/schema'
import { LIMITS } from './constants'
import { sniffImage } from './image-sniff'
import { deleteObject, getObjectBytes, putObject } from './s3'

/**
 * Optionale Bildprüfung durch einen Anbieter (EU/CH). Ohne Konfiguration wird nur technisch geprüft;
 * sichtbar wird ein Bild ohnehin erst nach der Freigabe durch die Moderation.
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

/** Alle Dateien eines Bildes im Bucket: Original in der Quarantäne und die neu kodierten Fassungen. */
export function mediaKeys(mediaId: string) {
  return [`quarantine/${mediaId}`, `media/${mediaId}.webp`, `media/${mediaId}.avif`]
}

export async function rejectMedia(mediaId: string, why: string) {
  console.warn(`[media] ${mediaId} abgelehnt: ${why}`)
  await db.update(postMedia).set({ status: 'rejected' }).where(eq(postMedia.id, mediaId))
  await Promise.all(mediaKeys(mediaId).map((k) => deleteObject(k).catch(() => {})))
}

/**
 * Bereinigt ein Bild aus der Quarantäne: Format prüfen, EXIF/GPS entfernen, als WebP + AVIF neu kodieren.
 * Danach wartet es auf die Moderation (`review`) – oder ist sofort sichtbar, wenn sie es schon freigegeben hat.
 */
export async function processMedia(mediaId: string, next: 'review' | 'ready' = 'review'): Promise<'review' | 'ready' | 'rejected' | 'skipped'> {
  const [row] = await db.select().from(postMedia).where(eq(postMedia.id, mediaId))
  if (!row || row.status !== 'quarantine') return 'skipped'
  const reject = async (why: string) => (await rejectMedia(mediaId, why), 'rejected' as const)

  let input: Uint8Array
  try {
    input = await getObjectBytes(row.bucketKey)
  } catch (e) {
    return reject(`Datei fehlt im Bucket (${(e as Error).message})`)
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
      .set({ status: next, bucketKey: key, width: webp.info.width, height: webp.info.height, blurhash, contentType: 'image/webp', size: webp.data.byteLength })
      .where(eq(postMedia.id, mediaId))
    await deleteObject(row.bucketKey).catch(() => {})
    return next
  } catch (e) {
    return reject((e as Error).message)
  }
}

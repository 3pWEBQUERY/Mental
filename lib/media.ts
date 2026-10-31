import { encode } from 'blurhash'
import { and, eq, inArray } from 'drizzle-orm'
import sharp from 'sharp'
import { db } from '../db'
import { postMedia } from '../db/schema'
import { LIMITS } from './constants'
import { sniffImage } from './image-sniff'
import { deleteObject, getObjectBytes, putObject } from './s3'
import { safeMessage } from './log-safe'

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

/** Lehnt ab, solange das Bild noch nicht freigegeben ist. Gibt zurück, ob dieser Aufruf es abgelehnt hat. */
export async function rejectMedia(mediaId: string, why: string): Promise<boolean> {
  const done = await db
    .update(postMedia)
    .set({ status: 'rejected' })
    .where(and(eq(postMedia.id, mediaId), inArray(postMedia.status, ['quarantine', 'review'])))
    .returning({ id: postMedia.id })
  if (!done.length) return false
  console.warn(`[media] ${mediaId} abgelehnt: ${why}`)
  await Promise.all(mediaKeys(mediaId).map((k) => deleteObject(k).catch(() => {})))
  return true
}

/** Das Bild selbst ist unbrauchbar – kein Grund, es erneut zu versuchen. */
class BadImage extends Error {}

/**
 * Bereinigt ein Bild aus der Quarantäne: Format prüfen, EXIF/GPS entfernen, als WebP + AVIF neu kodieren.
 * Danach wartet es auf die Moderation (`review`) – oder ist sofort sichtbar, wenn sie es schon freigegeben hat.
 *
 * Nur Fehler am Bild selbst führen zur Ablehnung. Netz-, Bucket- und Anbieterfehler werfen weiter,
 * damit pg-boss es erneut versucht – ein kurzer Ausfall darf keine Bilder verwerfen.
 */
export async function processMedia(mediaId: string, next: 'review' | 'ready' = 'review'): Promise<'review' | 'ready' | 'rejected' | 'skipped'> {
  const [row] = await db.select().from(postMedia).where(eq(postMedia.id, mediaId))
  if (!row || row.status !== 'quarantine') return 'skipped'

  let encoded: Awaited<ReturnType<typeof encode_>>
  try {
    const input = await getObjectBytes(row.bucketKey).catch((e: Error) => {
      if (e.name === 'NoSuchKey') throw new BadImage('Datei fehlt im Bucket')
      throw e
    })
    encoded = await encode_(input)
    if (!(await imageAllowed(encoded.webp.data))) throw new BadImage('Inhaltsprüfung')
  } catch (e) {
    if (e instanceof BadImage) return (await rejectMedia(mediaId, e.message)) ? 'rejected' : 'skipped'
    throw e
  }

  const key = `media/${mediaId}.webp`
  await putObject(key, encoded.webp.data, 'image/webp')
  await putObject(`media/${mediaId}.avif`, encoded.avif, 'image/avif')
  // Nur übernehmen, wenn niemand dazwischen entschieden hat (Ablehnung, Löschung, paralleler Lauf).
  const claimed = await db
    .update(postMedia)
    .set({
      status: next,
      bucketKey: key,
      width: encoded.webp.info.width,
      height: encoded.webp.info.height,
      blurhash: encoded.blurhash,
      contentType: 'image/webp',
      size: encoded.webp.data.byteLength,
    })
    .where(and(eq(postMedia.id, mediaId), eq(postMedia.status, 'quarantine')))
    .returning({ id: postMedia.id })
  if (!claimed.length) {
    const [now] = await db.select({ status: postMedia.status }).from(postMedia).where(eq(postMedia.id, mediaId))
    // Abgelehnt oder gelöscht: die eben hochgeladenen Fassungen dürfen nicht liegen bleiben.
    if (!now || now.status === 'rejected') await Promise.all(mediaKeys(mediaId).map((k) => deleteObject(k).catch(() => {})))
    return 'skipped'
  }
  await deleteObject(row.bucketKey).catch(() => {})
  return next
}

async function encode_(input: Uint8Array) {
  if (input.byteLength > LIMITS.imageMaxBytes) throw new BadImage('zu gross')
  if (!sniffImage(input)) throw new BadImage('kein JPEG/PNG/WebP')
  try {
    // rotate() übernimmt die EXIF-Ausrichtung; sharp schreibt ohne withMetadata() keine Metadaten (EXIF, GPS, Kamera).
    const base = sharp(input, { failOn: 'error', limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: LIMITS.imageMaxPx, height: LIMITS.imageMaxPx, fit: 'inside', withoutEnlargement: true })
    const webp = await base.clone().webp({ quality: 80 }).toBuffer({ resolveWithObject: true })
    const avif = await base.clone().avif({ quality: 50 }).toBuffer()
    const { data: px, info } = await sharp(webp.data).resize(32, 32, { fit: 'inside' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    return { webp, avif, blurhash: encode(new Uint8ClampedArray(px), info.width, info.height, 4, 3) }
  } catch (e) {
    throw new BadImage(`nicht lesbar (${safeMessage(e)})`)
  }
}

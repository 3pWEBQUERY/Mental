import 'server-only'
import { cacheLife, cacheTag } from 'next/cache'
import { asc, eq } from 'drizzle-orm'
import sharp from 'sharp'
import { db } from '@/db'
import { partnerMedia, partners } from '@/db/schema'

export type PublicPartner = { id: string; name: string; url: string | null; logo: { src: string; width: number; height: number } | null }

/** Partner auf der Startseite (aktiv, nach Reihenfolge). Admin-Änderungen gelten sofort (updateTag «partners»). */
export async function getPartners(): Promise<PublicPartner[]> {
  'use cache'
  cacheTag('partners')
  try {
    const rows = await db
      .select({ id: partners.id, name: partners.name, url: partners.url, mediaId: partnerMedia.id, width: partnerMedia.width, height: partnerMedia.height })
      .from(partners)
      .leftJoin(partnerMedia, eq(partnerMedia.id, partners.mediaId))
      .where(eq(partners.isActive, true))
      .orderBy(asc(partners.sort), asc(partners.name))
    cacheLife('hours')
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      url: r.url,
      logo: r.mediaId && r.width && r.height ? { src: `/api/partner-logo/${r.mediaId}`, width: r.width, height: r.height } : null,
    }))
  } catch {
    // Ohne Datenbank: Bereich einfach weglassen, kurz merken.
    cacheLife({ stale: 30, revalidate: 30, expire: 300 })
    return []
  }
}

export const LOGO_MAX_BYTES = 3 * 1024 * 1024
const FORMATS = new Set(['png', 'jpeg', 'webp', 'gif', 'svg', 'avif', 'heif'])

/**
 * Logo neu rechnen: Das Ergebnis ist immer ein WebP ohne Metadaten, höchstens 800×400 px. SVG wird dabei
 * gerastert – so kann eine hochgeladene Datei nie Skripte oder externe Verweise mitbringen.
 */
export async function processLogo(input: Buffer) {
  const meta = await sharp(input, { limitInputPixels: 40_000_000 }).metadata()
  if (!meta.format || !FORMATS.has(meta.format)) throw new Error('format')
  const svg = meta.format === 'svg'
  // SVG so dicht rastern, dass etwa 1600 px lange Seite herauskommt – fest 300 dpi sprengte bei grossen Zeichenflächen
  // die Pixelgrenze («liess sich nicht lesen»), bei kleinen würde es unscharf.
  const side = Math.max(meta.width ?? 0, meta.height ?? 0) || 400
  const density = svg ? Math.max(24, Math.min(600, Math.round((72 * 1600) / side))) : undefined
  const { data, info } = await sharp(input, { limitInputPixels: 40_000_000, density, animated: false })
    .rotate()
    .resize({ width: 800, height: 400, fit: 'inside', withoutEnlargement: !svg })
    .webp({ quality: 90, alphaQuality: 100, effort: 5 })
    .toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height, bytes: data.length }
}

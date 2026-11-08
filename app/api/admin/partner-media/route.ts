import { eq } from 'drizzle-orm'
import { revalidateTag } from 'next/cache'
import { db } from '@/db'
import { moderationActions, partnerMedia, partners } from '@/db/schema'
import { isUuid } from '@/lib/id'
import { canModerate, hasStrongAuth } from '@/lib/server/admin'
import { LOGO_MAX_BYTES, processLogo } from '@/lib/server/partners'
import { getViewer } from '@/lib/server/session'

const json = (status: number, body: Record<string, unknown>) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

/**
 * Logo hochladen (Admin → Partner). Eigener Route Handler statt Server-Aktion: Server-Aktionen sind bewusst
 * auf 1 MB begrenzt, Logos dürfen bis 3 MB gross sein. Nur Admins mit Passkey-Sitzung, nur von der eigenen Seite.
 * Optional gleich einem Partner zuweisen.
 */
export async function POST(request: Request) {
  const v = await getViewer()
  if (!v || !canModerate(v, 'admin') || !hasStrongAuth(v)) return json(403, { error: 'Nur für Admins mit Passkey.' })
  const site = request.headers.get('sec-fetch-site')
  const origin = request.headers.get('origin')
  if ((site && site !== 'same-origin') || (origin !== null && !sameHost(origin, request.headers.get('host'))))
    return json(403, { error: 'Nur von der eigenen Seite.' })
  // Ohne Content-Length (chunked) nicht annehmen – sonst läse formData() beliebig viel in den Speicher.
  const length = Number(request.headers.get('content-length') ?? NaN)
  if (!Number.isFinite(length) || length > LOGO_MAX_BYTES + 64 * 1024) return json(413, { error: 'Die Datei ist zu gross (höchstens 3 MB).' })

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return json(400, { error: 'Keine Datei erhalten.' })
  }
  const file = form.get('file')
  if (!(file instanceof File) || file.size === 0) return json(400, { error: 'Bitte eine Bilddatei wählen.' })
  if (file.size > LOGO_MAX_BYTES) return json(413, { error: 'Die Datei ist zu gross (höchstens 3 MB).' })
  const partnerId = form.get('partnerId')
  if (partnerId && !isUuid(partnerId)) return json(400, { error: 'Diesen Partner gibt es nicht.' })

  let logo: Awaited<ReturnType<typeof processLogo>>
  try {
    logo = await processLogo(Buffer.from(await file.arrayBuffer()))
  } catch {
    return json(415, { error: 'Das Bild liess sich nicht lesen. Erlaubt: PNG, JPEG, WebP, SVG, GIF, AVIF.' })
  }
  const name = (file.name || 'logo').replace(/[^\p{L}\p{N} ._()-]/gu, '').slice(0, 80) || 'logo'
  const result = await db.transaction(async (tx) => {
    const [row] = await tx.insert(partnerMedia).values({ name, data: logo.data, width: logo.width, height: logo.height, bytes: logo.bytes }).returning({ id: partnerMedia.id })
    let partner: string | null = null
    if (partnerId) {
      const [p] = await tx.update(partners).set({ mediaId: row!.id }).where(eq(partners.id, partnerId)).returning({ name: partners.name })
      partner = p?.name ?? null
    }
    await tx.insert(moderationActions).values({ moderatorId: v.userId, targetType: 'user', targetId: v.userId, action: 'partner-media:upload', reason: name })
    return { id: row!.id, partner }
  })
  revalidateTag('partners', { expire: 0 })
  return json(201, {
    id: result.id,
    message: result.partner ? `Logo hochgeladen und «${result.partner}» zugewiesen.` : `«${name}» hochgeladen (${logo.width}×${logo.height}).`,
  })
}

/** Origin «null» oder unlesbar zählt als fremd (403 statt Serverfehler). */
function sameHost(origin: string, host: string | null) {
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

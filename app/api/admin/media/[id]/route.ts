import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { postMedia } from '@/db/schema'
import { isUuid } from '@/lib/id'
import { bucketConfigured, presignDownload } from '@/lib/s3'
import { canModerate, hasStrongAuth } from '@/lib/server/admin'
import { getViewer } from '@/lib/server/session'

const PREVIEWABLE = ['image/jpeg', 'image/png', 'image/webp']

/** Vorschau für die Bildfreigabe: nur Moderation mit Passkey-Sitzung, auch für Bilder vor der Freigabe. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const v = await getViewer()
  if (!v || !canModerate(v, 'mod') || !hasStrongAuth(v)) return new Response(null, { status: 404 })
  const { id } = await params
  if (!isUuid(id) || !bucketConfigured()) return new Response(null, { status: 404 })
  const [row] = await db.select({ key: postMedia.bucketKey, type: postMedia.contentType, status: postMedia.status }).from(postMedia).where(eq(postMedia.id, id))
  if (!row || row.status === 'rejected' || !PREVIEWABLE.includes(row.type)) return new Response(null, { status: 404 })
  const url = await presignDownload(row.key, 300, { contentType: row.type })
  return new Response(null, { status: 302, headers: { Location: url, 'Cache-Control': 'private, no-store', 'Content-Disposition': 'inline' } })
}

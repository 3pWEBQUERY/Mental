import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { partnerMedia } from '@/db/schema'
import { isUuid } from '@/lib/id'

/**
 * Partner-Logo für die Startseite: öffentlich. Der Inhalt einer ID ändert sich nie (neues Logo = neue ID),
 * darum ein Jahr im Browser-Cache. Immer als Bild ausgeliefert, nie als Dokument.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isUuid(id)) return new Response(null, { status: 404 })
  const [row] = await db.select({ data: partnerMedia.data, type: partnerMedia.contentType }).from(partnerMedia).where(eq(partnerMedia.id, id))
  if (!row) return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } })
  return new Response(new Uint8Array(row.data), {
    headers: {
      'Content-Type': row.type,
      'Content-Length': String(row.data.length),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Disposition': 'inline',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Cross-Origin-Resource-Policy': 'same-origin',
    },
  })
}

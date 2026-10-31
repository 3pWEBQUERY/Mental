import { and, eq, gt } from 'drizzle-orm'
import { db } from '@/db'
import { exports } from '@/db/schema'
import { isUuid } from '@/lib/id'
import { presignDownload } from '@/lib/s3'
import { getViewer } from '@/lib/server/session'

/** Datenexport: nur für die eigene Person, signierter Link, solange der Export gültig ist (24 h). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const v = await getViewer()
  if (!v) return new Response(null, { status: 401 })
  const { id } = await params
  if (!isUuid(id)) return new Response(null, { status: 404 })
  const [row] = await db
    .select()
    .from(exports)
    .where(and(eq(exports.id, id), eq(exports.userId, v.userId), eq(exports.status, 'ready'), gt(exports.expiresAt, new Date())))
  if (!row?.bucketKey || !row.expiresAt) return new Response(null, { status: 404 })
  const seconds = Math.max(60, Math.floor((row.expiresAt.getTime() - Date.now()) / 1000))
  const url = await presignDownload(row.bucketKey, seconds, { contentType: 'application/zip', filename: 'jiaia-export.zip' })
  return new Response(null, { status: 302, headers: { Location: url, 'Cache-Control': 'no-store' } })
}

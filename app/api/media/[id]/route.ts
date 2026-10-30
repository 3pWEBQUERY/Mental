import { and, eq, isNull } from 'drizzle-orm'
import { db } from '@/db'
import { postMedia, posts } from '@/db/schema'
import { isUuid } from '@/lib/id'
import { bucketConfigured, presignDownload } from '@/lib/s3'
import { getViewer } from '@/lib/server/session'

/** Prüft die Sitzung und leitet auf eine 10 Minuten gültige, signierte URL weiter (Bucket-Egress). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const v = await getViewer()
  if (!v) return new Response(null, { status: 401 })
  const { id } = await params
  if (!isUuid(id) || !bucketConfigured()) return new Response(null, { status: 404 })
  const [row] = await db
    .select({ key: postMedia.bucketKey, owner: posts.userId, status: posts.status })
    .from(postMedia)
    .innerJoin(posts, eq(posts.id, postMedia.postId))
    .where(and(eq(postMedia.id, id), eq(postMedia.status, 'ready'), isNull(posts.deletedAt)))
  if (!row || (row.status !== 'visible' && row.owner !== v.userId)) return new Response(null, { status: 404 })
  const accept = request.headers.get('accept') ?? ''
  const key = accept.includes('image/avif') ? row.key.replace(/\.webp$/, '.avif') : row.key
  const url = await presignDownload(key, 600, { contentType: key.endsWith('.avif') ? 'image/avif' : 'image/webp' })
  return new Response(null, { status: 302, headers: { Location: url, 'Cache-Control': 'private, max-age=300', 'Content-Disposition': 'inline' } })
}

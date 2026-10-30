import { and, eq, gt, count } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { postMedia } from '@/db/schema'
import { IMAGE_TYPES, LIMITS } from '@/lib/constants'
import { uuidv7 } from '@/lib/id'
import { bucketConfigured, presignUpload } from '@/lib/s3'
import { getViewer } from '@/lib/server/session'
import { m } from '@/messages'

const schema = z.object({ type: z.enum(IMAGE_TYPES), size: z.number().int().positive().max(LIMITS.imageMaxBytes) })

/**
 * Signierte PUT-URL für quarantine/<uuid>, 5 Minuten gültig, Content-Type und Grösse fest.
 * Die Datei fliesst direkt vom Browser in den Bucket, nie durch den Web-Service.
 */
export async function POST(request: Request) {
  const v = await getViewer()
  if (!v) return Response.json({ error: m.common.sessionEnded }, { status: 401 })
  if (v.status === 'muted') return Response.json({ error: m.common.muted }, { status: 403 })
  if (!bucketConfigured()) return Response.json({ error: m.composer.imagesUnavailable }, { status: 503 })
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: m.composer.imageType }, { status: 400 })

  const [{ n } = { n: 0 }] = await db
    .select({ n: count() })
    .from(postMedia)
    .where(and(eq(postMedia.userId, v.userId), gt(postMedia.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000))))
  if (n >= LIMITS.postsPerDay) return Response.json({ error: m.composer.limit }, { status: 429 })

  const id = uuidv7()
  const key = `quarantine/${id}`
  await db.insert(postMedia).values({ id, userId: v.userId, bucketKey: key, contentType: parsed.data.type, size: parsed.data.size })
  const url = await presignUpload(key, parsed.data.type, parsed.data.size)
  return Response.json({ mediaId: id, url })
}

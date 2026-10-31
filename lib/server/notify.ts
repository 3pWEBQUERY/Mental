import 'server-only'
import { and, eq, gt, inArray, sql } from 'drizzle-orm'
import { db } from '@/db'
import { notifications, users, type NotificationPayload } from '@/db/schema'
import type { SupportKind } from '../constants'
import { enqueue, QUEUES } from '../jobs'
import { safeMessage } from '../log-safe'

export const NOTIFY_CHANNEL = 'lichtung_notify'

/** Weckt offene SSE-Verbindungen dieser Person – über alle Replikas hinweg (Postgres LISTEN/NOTIFY). */
async function ping(userId: string) {
  await db.execute(sql`SELECT pg_notify(${NOTIFY_CHANNEL}, ${userId})`)
}

const excerpt = (body: string) => (body.length > 90 ? `${body.slice(0, 88).trimEnd()} …` : body)

export async function notifyReply(ownerId: string, postId: string, postBody: string) {
  await db.insert(notifications).values({ userId: ownerId, kind: 'reply', postId, payload: { excerpt: excerpt(postBody) } })
  await ping(ownerId)
  // Push nur für «neue Antwort» und nur nach Zustimmung – der Worker prüft Ruhezeiten.
  await enqueue(QUEUES.push, { userId: ownerId, postId }).catch((e) => console.error('[push] enqueue', safeMessage(e)))
}

/** Zuspruch wird gebündelt: höchstens eine Meldung pro Gedanke und Stunde. */
export async function notifySupport(ownerId: string, postId: string, kind: SupportKind, postBody: string) {
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const [existing] = await db
    .select({ id: notifications.id, payload: notifications.payload })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, ownerId),
        eq(notifications.postId, postId),
        eq(notifications.kind, 'support'),
        gt(notifications.createdAt, hourAgo),
      ),
    )
    .limit(1)
  if (existing) {
    const kinds = { ...existing.payload.kinds, [kind]: (existing.payload.kinds?.[kind] ?? 0) + 1 }
    const payload: NotificationPayload = { ...existing.payload, kinds, count: (existing.payload.count ?? 0) + 1 }
    await db.update(notifications).set({ payload, readAt: null }).where(eq(notifications.id, existing.id))
  } else {
    await db.insert(notifications).values({
      userId: ownerId,
      kind: 'support',
      postId,
      payload: { count: 1, kinds: { [kind]: 1 }, excerpt: excerpt(postBody) },
    })
  }
  await ping(ownerId)
}

export async function notifyModeration(userId: string, postId: string | null, message: string, appealable = false) {
  await db.insert(notifications).values({ userId, kind: 'moderation', postId, payload: appealable ? { message, appealable } : { message } })
  await ping(userId)
}

/** Hinweis zur Kontosicherheit oder zum Betrieb – erscheint in der Glocke, nicht als Push. */
export async function notifySystem(userIds: string[], message: string) {
  if (!userIds.length) return
  await db.insert(notifications).values(userIds.map((userId) => ({ userId, kind: 'system' as const, postId: null, payload: { message } })))
  for (const id of userIds) await ping(id)
}

/** Alle Admins – für Ereignisse, die ein zweites Paar Augen brauchen (z. B. neuer Passkey an einem Moderationskonto). */
export async function notifyAdmins(message: string, except?: string) {
  const admins = await db.select({ id: users.id }).from(users).where(inArray(users.role, ['admin']))
  await notifySystem(
    admins.map((a) => a.id).filter((id) => id !== except),
    message,
  )
}

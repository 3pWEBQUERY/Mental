'use server'

import { and, asc, desc, eq } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { db } from '@/db'
import { blocks, exports, passkeys, postHides, profiles, pushSubscriptions, sessions, users, type Settings } from '@/db/schema'
import { LIMITS } from '@/lib/constants'
import { enqueue, QUEUES } from '@/lib/jobs'
import { hmac } from '@/lib/server/crypto'
import { hashSecret, isPwned, verifySecret } from '@/lib/server/password'
import { hit } from '@/lib/server/rate-limit'
import { generateRecoveryKey } from '@/lib/server/recovery'
import { endOtherSessions, getViewer, SESSION_COOKIE } from '@/lib/server/session'
import { m } from '@/messages'

type R<T = object> = ({ ok: true } & T) | { ok: false; error: string }
const fail = (error: string) => ({ ok: false as const, error })

async function viewer() {
  const v = await getViewer()
  if (!v) throw new Error('unauthorized')
  return v
}

async function checkPassword(userId: string, password: string) {
  if (!(await hit(`pw-check:${userId}`, 10, 15 * 60_000)).ok) return false
  const [u] = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, userId))
  return Boolean(u && (await verifySecret(u.hash, password)))
}

/* ------------------------------------------------------------ Identität */

export async function updateIdentity(input: { displayName: string; defaultVisibility: 'anonymous' | 'pseudonym' }): Promise<R> {
  const v = await viewer()
  const parsed = z
    .object({ displayName: z.string().trim().min(2).max(LIMITS.displayNameMax), defaultVisibility: z.enum(['anonymous', 'pseudonym']) })
    .safeParse(input)
  if (!parsed.success) return fail(m.common.error)
  await db
    .update(profiles)
    .set({ displayName: parsed.data.displayName.replace(/\s+/g, ' '), defaultVisibility: parsed.data.defaultVisibility })
    .where(eq(profiles.userId, v.userId))
  return { ok: true }
}

/** Einstellungen, die nur Darstellung und Verhalten betreffen. */
const settingsSchema = z
  .object({
    theme: z.enum(['system', 'light', 'dark']),
    fontSize: z.enum(['normal', 'large', 'xlarge']),
    motion: z.enum(['on', 'reduced', 'off']),
    breathSound: z.boolean(),
    hidePresence: z.boolean(),
    collapseWarnings: z.boolean(),
  })
  .partial()

export async function updateSettings(patch: Partial<Settings>): Promise<R> {
  const v = await viewer()
  const parsed = settingsSchema.safeParse(patch)
  if (!parsed.success) return fail(m.common.error)
  await db.update(profiles).set({ settings: { ...v.settings, ...parsed.data } }).where(eq(profiles.userId, v.userId))
  return { ok: true }
}

/* ------------------------------------------------------------ Sicherheit */

export async function changePassword(input: { current: string; next: string }): Promise<R> {
  const v = await viewer()
  if (!(await checkPassword(v.userId, input.current))) return fail(m.auth.invalid)
  if (input.next.length < 10 || input.next.length > 256) return fail(m.register.passwordShort)
  if (await isPwned(input.next)) return fail(m.register.passwordPwned)
  await db.update(users).set({ passwordHash: await hashSecret(input.next) }).where(eq(users.id, v.userId))
  await endOtherSessions(v.userId, v.sessionId)
  return { ok: true }
}

export async function regenerateRecoveryKey(password: string): Promise<R<{ words: string[] }>> {
  const v = await viewer()
  if (!(await checkPassword(v.userId, password))) return fail(m.auth.invalid)
  const words = generateRecoveryKey()
  await db.update(users).set({ recoveryHash: await hashSecret(words.join(' ')) }).where(eq(users.id, v.userId))
  return { ok: true, words }
}

export type PasskeyItem = { id: string; label: string; createdAt: string; lastUsedAt: string | null }
export async function listPasskeys(): Promise<PasskeyItem[]> {
  const v = await viewer()
  const rows = await db.select().from(passkeys).where(eq(passkeys.userId, v.userId)).orderBy(asc(passkeys.createdAt))
  return rows.map((p) => ({
    id: p.id,
    label: p.label ?? (p.deviceType === 'multiDevice' ? 'Synchronisierter Passkey' : 'Passkey auf einem Gerät'),
    createdAt: p.createdAt.toISOString(),
    lastUsedAt: p.lastUsedAt?.toISOString() ?? null,
  }))
}

export async function removePasskey(id: string): Promise<R> {
  const v = await viewer()
  if (!z.uuid().safeParse(id).success) return fail(m.common.error)
  await db.delete(passkeys).where(and(eq(passkeys.id, id), eq(passkeys.userId, v.userId)))
  return { ok: true }
}

export type SessionItem = { id: string; device: string; createdAt: string; lastSeenAt: string; current: boolean }
export async function listSessions(): Promise<SessionItem[]> {
  const v = await viewer()
  const rows = await db.select().from(sessions).where(eq(sessions.userId, v.userId)).orderBy(desc(sessions.lastSeenAt))
  return rows.map((s) => ({
    id: s.id,
    device: s.deviceLabel,
    createdAt: s.createdAt.toISOString(),
    lastSeenAt: s.lastSeenAt.toISOString(),
    current: s.id === v.sessionId,
  }))
}

export async function endSession(id: string | 'others'): Promise<R> {
  const v = await viewer()
  if (id === 'others') await endOtherSessions(v.userId, v.sessionId)
  else if (z.uuid().safeParse(id).success) await db.delete(sessions).where(and(eq(sessions.id, id), eq(sessions.userId, v.userId)))
  return { ok: true }
}

/* ----------------------------------------------------------- Blockiert */

/** Blockierte erscheinen als «Mitglied 1, 2 …», ausgeblendete anonyme Gedanken ohne Inhalt – ohne ID, die etwas verraten könnte. */
export async function listBlocked(): Promise<{ ref: string; since: string; kind: 'member' | 'post' }[]> {
  const v = await viewer()
  const [members, hidden] = await Promise.all([
    db.select().from(blocks).where(eq(blocks.blockerId, v.userId)).orderBy(asc(blocks.createdAt)),
    db.select().from(postHides).where(eq(postHides.userId, v.userId)).orderBy(asc(postHides.createdAt)),
  ])
  return [
    ...members.map((b) => ({ ref: blockRef(v.userId, b.blockedId), since: b.createdAt.toISOString(), kind: 'member' as const })),
    ...hidden.map((h) => ({ ref: blockRef(v.userId, h.postId, 'post'), since: h.createdAt.toISOString(), kind: 'post' as const })),
  ]
}

function blockRef(viewerId: string, targetId: string, kind: 'member' | 'post' = 'member') {
  return hmac(`${viewerId}:${kind === 'post' ? 'post:' : ''}${targetId}`, 'block-ref').slice(0, 24)
}

export async function unblock(ref: string): Promise<R> {
  const v = await viewer()
  const [members, hidden] = await Promise.all([
    db.select().from(blocks).where(eq(blocks.blockerId, v.userId)),
    db.select().from(postHides).where(eq(postHides.userId, v.userId)),
  ])
  const member = members.find((b) => blockRef(v.userId, b.blockedId) === ref)
  if (member) {
    await db.delete(blocks).where(and(eq(blocks.blockerId, v.userId), eq(blocks.blockedId, member.blockedId)))
    return { ok: true }
  }
  const post = hidden.find((h) => blockRef(v.userId, h.postId, 'post') === ref)
  if (!post) return fail(m.common.error)
  await db.delete(postHides).where(and(eq(postHides.userId, v.userId), eq(postHides.postId, post.postId)))
  return { ok: true }
}

/* ------------------------------------------------------------- Push */

const subSchema = z.object({
  endpoint: z.url().max(1000),
  keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }),
})

export async function savePushSubscription(sub: unknown, quiet: { from: number; to: number }): Promise<R> {
  const v = await viewer()
  const parsed = subSchema.safeParse(sub)
  const q = z.object({ from: z.number().int().min(0).max(23), to: z.number().int().min(0).max(23) }).safeParse(quiet)
  if (!parsed.success || !q.success) return fail(m.common.error)
  await db
    .insert(pushSubscriptions)
    .values({ userId: v.userId, endpoint: parsed.data.endpoint, keys: parsed.data.keys, quietFrom: q.data.from, quietTo: q.data.to })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId: v.userId, keys: parsed.data.keys, quietFrom: q.data.from, quietTo: q.data.to },
    })
  return { ok: true }
}

export async function removePushSubscription(endpoint: string): Promise<R> {
  const v = await viewer()
  await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.userId, v.userId), eq(pushSubscriptions.endpoint, endpoint)))
  return { ok: true }
}

export async function updateQuietHours(from: number, to: number): Promise<R> {
  const v = await viewer()
  const q = z.object({ from: z.number().int().min(0).max(23), to: z.number().int().min(0).max(23) }).safeParse({ from, to })
  if (!q.success) return fail(m.common.error)
  await db.update(pushSubscriptions).set({ quietFrom: q.data.from, quietTo: q.data.to }).where(eq(pushSubscriptions.userId, v.userId))
  return { ok: true }
}

/* ------------------------------------------------------------ Daten */

export type ExportState = { status: 'none' | 'pending' | 'ready' | 'failed'; id?: string }

export async function requestExport(): Promise<R<ExportState>> {
  const v = await viewer()
  if (!(await hit(`export:${v.userId}`, 3, 24 * 60 * 60_000)).ok) return fail(m.common.rateLimited)
  const [row] = await db.insert(exports).values({ userId: v.userId }).returning({ id: exports.id })
  await enqueue(QUEUES.exportAccount, { exportId: row!.id })
  return { ok: true, status: 'pending', id: row!.id }
}

export async function exportStatus(): Promise<ExportState> {
  const v = await viewer()
  const [row] = await db.select().from(exports).where(eq(exports.userId, v.userId)).orderBy(desc(exports.createdAt)).limit(1)
  if (!row) return { status: 'none' }
  if (row.status === 'ready' && row.expiresAt && row.expiresAt < new Date()) return { status: 'none' }
  return { status: row.status, id: row.id }
}

/**
 * Konto löschen: sofort deaktiviert und unsichtbar, nach 7 Tagen endgültig gelöscht.
 * Ein Login innerhalb der 7 Tage bricht die Löschung ab.
 */
export async function deleteAccount(password: string): Promise<R> {
  const v = await viewer()
  if (!(await checkPassword(v.userId, password))) return fail(m.auth.invalid)
  const deleteAfter = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  await db.update(users).set({ status: 'deleting', deleteAfter }).where(eq(users.id, v.userId))
  await db.delete(sessions).where(eq(sessions.userId, v.userId))
  await enqueue(QUEUES.purgeAccount, { userId: v.userId }, { startAfter: deleteAfter, singletonKey: `purge:${v.userId}` })
  ;(await cookies()).delete(SESSION_COOKIE)
  return { ok: true }
}

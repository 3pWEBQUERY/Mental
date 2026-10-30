'use server'

import { and, eq } from 'drizzle-orm'
import { updateTag } from 'next/cache'
import { z } from 'zod'
import { db } from '@/db'
import {
  circles,
  crisisTerms,
  helpResources,
  moderationActions,
  posts,
  replies,
  reports,
  sessions,
  steps,
  users,
} from '@/db/schema'
import { assertModerator } from '@/lib/server/admin'
import { notifyModeration } from '@/lib/server/notify'
import { m } from '@/messages'

const ACTIONS = ['approve', 'hide', 'cw', 'warn', 'mute24', 'mute7', 'ban', 'dismiss'] as const
type Action = (typeof ACTIONS)[number]
/** Peer-Moderator:innen: nur ausblenden und Inhaltshinweis, keine Sperren. */
const PEER_ACTIONS: Action[] = ['hide', 'cw']

const MESSAGES: Partial<Record<Action, (reason: string) => string>> = m.admin.notify

export async function moderate(form: FormData) {
  const parsed = z
    .object({
      targetType: z.enum(['post', 'reply']),
      targetId: z.uuid(),
      action: z.enum(ACTIONS),
      reason: z.string().max(500).optional(),
    })
    .safeParse(Object.fromEntries(form))
  if (!parsed.success) throw new Error('invalid')
  const { targetType, targetId, action } = parsed.data
  const reason = parsed.data.reason?.trim() ?? ''
  const mod = await assertModerator(PEER_ACTIONS.includes(action) ? 'peer' : 'mod')

  const [target] =
    targetType === 'post'
      ? await db.select({ userId: posts.userId, postId: posts.id }).from(posts).where(eq(posts.id, targetId))
      : await db.select({ userId: replies.userId, postId: replies.postId }).from(replies).where(eq(replies.id, targetId))
  if (!target) throw new Error('not found')

  const setStatus = async (status: 'visible' | 'hidden') => {
    if (targetType === 'post') await db.update(posts).set({ status, moderationNote: status === 'hidden' ? reason || null : null }).where(eq(posts.id, targetId))
    else {
      const [before] = await db.select({ status: replies.status, isAuthor: replies.isAuthor }).from(replies).where(eq(replies.id, targetId))
      await db.update(replies).set({ status }).where(eq(replies.id, targetId))
      // Freigegebene Antworten zählen jetzt für «Braucht Zuspruch».
      if (status === 'visible' && before?.status !== 'visible' && !before?.isAuthor) {
        const [p] = await db.select({ n: posts.replyCount }).from(posts).where(eq(posts.id, target.postId))
        await db.update(posts).set({ replyCount: (p?.n ?? 0) + 1 }).where(eq(posts.id, target.postId))
      }
    }
  }

  switch (action) {
    case 'approve':
      await setStatus('visible')
      break
    case 'hide':
      await setStatus('hidden')
      break
    case 'cw':
      if (targetType === 'post') await db.update(posts).set({ contentWarning: true, status: 'visible' }).where(eq(posts.id, targetId))
      break
    case 'mute24':
    case 'mute7':
      if (target.userId) {
        const hours = action === 'mute24' ? 24 : 24 * 7
        await db.update(users).set({ status: 'muted', mutedUntil: new Date(Date.now() + hours * 3600_000) }).where(eq(users.id, target.userId))
      }
      break
    case 'ban':
      if (target.userId) {
        await db.update(users).set({ status: 'banned' }).where(eq(users.id, target.userId))
        await db.delete(sessions).where(eq(sessions.userId, target.userId))
      }
      break
  }

  await db
    .update(reports)
    .set({ status: action === 'dismiss' ? 'dismissed' : 'resolved', resolvedAt: new Date() })
    .where(and(eq(reports.targetType, targetType), eq(reports.targetId, targetId), eq(reports.status, 'open')))

  await db.insert(moderationActions).values({ moderatorId: mod.userId, targetType, targetId, action, reason: reason || null })
  if (target.userId && ['mute24', 'mute7', 'ban'].includes(action)) {
    await db.insert(moderationActions).values({ moderatorId: mod.userId, targetType: 'user', targetId: target.userId, action, reason: reason || null })
  }
  const message = MESSAGES[action]?.(reason)
  if (message && target.userId) await notifyModeration(target.userId, targetType === 'post' ? targetId : target.postId, message)
}

/* ------------------------------------------------------------- Listen */

async function audit(moderatorId: string, action: string, targetId: string, reason?: string) {
  await db.insert(moderationActions).values({ moderatorId, targetType: 'user', targetId, action, reason: reason ?? null })
}

const str = (max: number) => z.string().trim().min(1).max(max)

export async function saveCircle(form: FormData) {
  const admin = await assertModerator('admin')
  const d = z
    .object({
      id: z.uuid().optional().or(z.literal('')),
      slug: z.string().regex(/^[a-z0-9-]{2,40}$/),
      name: str(40),
      description: str(400),
      rules: str(400),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      sort: z.coerce.number().int().min(0).max(999),
      isActive: z.string().optional(),
    })
    .parse(Object.fromEntries(form))
  const values = { slug: d.slug, name: d.name, description: d.description, rules: d.rules, color: d.color, sort: d.sort, isActive: d.isActive === 'on' }
  if (d.id) await db.update(circles).set(values).where(eq(circles.id, d.id))
  else await db.insert(circles).values(values)
  await audit(admin.userId, d.id ? 'circle:update' : 'circle:create', admin.userId, d.slug)
  updateTag('circles')
}

export async function saveHelp(form: FormData) {
  const admin = await assertModerator('admin')
  const d = z
    .object({
      id: z.uuid().optional().or(z.literal('')),
      name: str(80),
      phone: z.string().trim().max(20).optional(),
      url: z.url().optional().or(z.literal('')),
      hours: str(80),
      audience: str(120),
      sort: z.coerce.number().int().min(0).max(999),
      remove: z.string().optional(),
    })
    .parse(Object.fromEntries(form))
  if (d.id && d.remove) await db.delete(helpResources).where(eq(helpResources.id, d.id))
  else {
    const values = { name: d.name, phone: d.phone || null, url: d.url || null, hours: d.hours, audience: d.audience, sort: d.sort }
    if (d.id) await db.update(helpResources).set(values).where(eq(helpResources.id, d.id))
    else await db.insert(helpResources).values(values)
  }
  await audit(admin.userId, 'help:update', admin.userId, d.name)
  updateTag('help')
}

export async function saveTerm(form: FormData) {
  const admin = await assertModerator('admin')
  const d = z
    .object({ term: str(80), level: z.enum(['concern', 'acute']), remove: z.string().optional(), id: z.uuid().optional().or(z.literal('')) })
    .parse(Object.fromEntries(form))
  if (d.id && d.remove) await db.delete(crisisTerms).where(eq(crisisTerms.id, d.id))
  else await db.insert(crisisTerms).values({ term: d.term.toLowerCase(), level: d.level }).onConflictDoUpdate({ target: [crisisTerms.language, crisisTerms.term], set: { level: d.level } })
  await audit(admin.userId, 'crisis-terms:update', admin.userId, d.term)
  updateTag('crisis-terms')
}

export async function saveStep(form: FormData) {
  const admin = await assertModerator('admin')
  const d = z
    .object({
      id: z.uuid().optional().or(z.literal('')),
      text: str(200),
      circleId: z.uuid().optional().or(z.literal('')),
      sort: z.coerce.number().int().min(0).max(999),
      isActive: z.string().optional(),
    })
    .parse(Object.fromEntries(form))
  const values = { text: d.text, circleId: d.circleId || null, sort: d.sort, isActive: d.isActive === 'on' }
  if (d.id) await db.update(steps).set(values).where(eq(steps.id, d.id))
  else await db.insert(steps).values(values)
  await audit(admin.userId, 'steps:update', admin.userId, d.text.slice(0, 60))
}

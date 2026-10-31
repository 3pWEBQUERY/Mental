'use server'

import { and, count, desc, eq, gt, gte, isNull, lt, ne, notInArray, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import {
  blocks,
  bookmarks,
  breathLog,
  checkins,
  circlePrefs,
  circlePresence,
  circles,
  letters,
  notifications,
  postHides,
  postMedia,
  posts,
  profiles,
  replies,
  reports,
  stepLog,
  steps,
  support,
  users,
} from '@/db/schema'
import { LIMITS, MOOD_HEAVY, NEEDS, REPORT_REASONS, SUPPORT_KINDS } from '@/lib/constants'
import { hardDeletePost } from '@/lib/post-delete'
import { syncReplyCount } from '@/lib/reply-count'
import { detectCrisis } from '@/lib/crisis'
import { toPublicReply, type PublicPost, type PublicReply } from '@/lib/dto'
import { enqueue, QUEUES } from '@/lib/jobs'
import { randomSeed } from '@/lib/server/crypto'
import { hit } from '@/lib/server/rate-limit'
import { notifyReply, notifySupport } from '@/lib/server/notify'
import { getFeed, getPostById, type FeedPage, type FeedView } from '@/lib/server/posts'
import { getViewer, type Viewer } from '@/lib/server/session'
import { getCrisisTerms } from '@/lib/server/terms'
import { zurichDay } from '@/lib/time'
import { m } from '@/messages'

type Fail = { ok: false; error: string }
type Ok<T> = { ok: true } & T
const fail = (error: string): Fail => ({ ok: false, error })
const DAY = 24 * 60 * 60 * 1000

async function writer(): Promise<Viewer | Fail> {
  const v = await getViewer()
  if (!v) return fail(m.common.sessionEnded)
  if (v.status === 'muted') return fail(m.common.muted)
  return v
}
const isFail = (v: unknown): v is Fail => typeof v === 'object' && v !== null && (v as Fail).ok === false

async function touchPresence(userId: string, circleId: string) {
  await db
    .insert(circlePresence)
    .values({ userId, circleId })
    .onConflictDoUpdate({ target: [circlePresence.userId, circlePresence.circleId], set: { seenAt: new Date() } })
}

/** Darf diese Person den Gedanken sehen und darauf reagieren? */
async function visiblePost(viewerId: string, postId: string) {
  const [p] = await db
    .select({
      id: posts.id,
      userId: posts.userId,
      body: posts.body,
      status: posts.status,
      closed: posts.closed,
      circleId: posts.circleId,
      authorHandle: posts.authorHandle,
      glyphSeed: posts.glyphSeed,
      visibility: posts.visibility,
      createdAt: posts.createdAt,
    })
    .from(posts)
    .where(and(eq(posts.id, postId), isNull(posts.deletedAt)))
    .limit(1)
  if (!p) return null
  if (p.status !== 'visible' && p.userId !== viewerId) return null
  const [hidden] = await db
    .select({ x: postHides.postId })
    .from(postHides)
    .where(and(eq(postHides.userId, viewerId), eq(postHides.postId, postId)))
    .limit(1)
  if (hidden) return null
  // Anonyme Gedanken prüfen keinen Konto-Block – eine Fehlermeldung verriete sonst, wer dahintersteht.
  if (p.visibility === 'anonymous') return p
  const [blocked] = await db
    .select({ x: blocks.blockerId })
    .from(blocks)
    .where(
      sql`(${blocks.blockerId} = ${viewerId} AND ${blocks.blockedId} = ${p.userId}) OR (${blocks.blockerId} = ${p.userId} AND ${blocks.blockedId} = ${viewerId})`,
    )
    .limit(1)
  return blocked ? null : p
}

/* ------------------------------------------------------------- Gedanken */

const postSchema = z.object({
  body: z.string().trim().min(LIMITS.postMin).max(LIMITS.postMax),
  need: z.enum(NEEDS),
  circle: z.string().min(1).max(40),
  mood: z.number().int().min(0).max(4),
  visibility: z.enum(['anonymous', 'pseudonym']),
  contentWarning: z.boolean(),
  mediaId: z.uuid().nullish(),
  /** «Gedanke loslassen»: nach so vielen Tagen automatisch löschen (0 = nie). */
  letGoDays: z.union([z.literal(0), z.literal(1), z.literal(7), z.literal(30)]).default(0),
})

export async function createPost(input: z.input<typeof postSchema>): Promise<Ok<{ post: PublicPost; acute: boolean }> | Fail> {
  const v = await writer()
  if (isFail(v)) return v
  const parsed = postSchema.safeParse(input)
  if (!parsed.success) return fail(m.common.error)
  const d = parsed.data

  const isNew = Date.now() - v.createdAt.getTime() < LIMITS.newAccountMs
  const [{ n } = { n: 0 }] = await db
    .select({ n: count() })
    .from(posts)
    .where(and(eq(posts.userId, v.userId), gt(posts.createdAt, new Date(Date.now() - DAY))))
  if (n >= (isNew ? LIMITS.postsPerDayNew : LIMITS.postsPerDay)) return fail(m.composer.limit)

  const [circle] = await db.select({ id: circles.id }).from(circles).where(and(eq(circles.slug, d.circle), eq(circles.isActive, true)))
  if (!circle) return fail(m.common.error)

  // Stufe 2, sofort und lokal: «acute» ist bis zur Prüfung nur für die Autorin sichtbar.
  const level = detectCrisis(d.body, await getCrisisTerms())
  const anonymous = d.visibility === 'anonymous'
  const [row] = await db
    .insert(posts)
    .values({
      userId: v.userId,
      circleId: circle.id,
      need: d.need,
      mood: d.mood,
      body: d.body,
      visibility: d.visibility,
      authorHandle: anonymous ? m.common.anonymous : v.displayName,
      glyphSeed: anonymous ? randomSeed() : v.glyphSeed,
      contentWarning: d.contentWarning,
      expiresAt: d.letGoDays ? new Date(Date.now() + d.letGoDays * DAY) : null,
      status: level === 'acute' ? 'pending' : 'visible',
      crisisLevel: level,
    })
    .returning({ id: posts.id })
  const postId = row!.id

  if (level === 'acute') {
    await db.insert(reports).values({ targetType: 'post', targetId: postId, reason: 'auto_acute', priority: 0 })
  }
  if (d.mediaId) {
    const attached = await db
      .update(postMedia)
      .set({ postId })
      .where(and(eq(postMedia.id, d.mediaId), eq(postMedia.userId, v.userId), isNull(postMedia.postId)))
      .returning({ id: postMedia.id })
    // Der Gedanke ist gespeichert; scheitert nur der Auftrag, holt der Worker das Bild per Zeitplan nach.
    if (attached.length) await enqueue(QUEUES.processImage, { mediaId: d.mediaId }).catch((e) => console.error('[process-image] enqueue', e))
  }
  await enqueue(QUEUES.moderate, { targetType: 'post', targetId: postId }).catch((e) => console.error('[moderate]', e))
  await touchPresence(v.userId, circle.id)

  const post = await getPostById(v.userId, postId)
  return { ok: true, post: post!, acute: level === 'acute' }
}

const editSchema = postSchema.pick({ body: true, need: true, circle: true, contentWarning: true }).extend({ id: z.uuid() })

export async function updatePost(input: z.input<typeof editSchema>): Promise<Ok<{ post: PublicPost }> | Fail> {
  const v = await writer()
  if (isFail(v)) return v
  const parsed = editSchema.safeParse(input)
  if (!parsed.success) return fail(m.common.error)
  const d = parsed.data
  const [p] = await db
    .select({ createdAt: posts.createdAt, status: posts.status })
    .from(posts)
    .where(and(eq(posts.id, d.id), eq(posts.userId, v.userId), isNull(posts.deletedAt)))
  if (!p) return fail(m.common.error)
  if (Date.now() - p.createdAt.getTime() > LIMITS.editWindowMs) return fail(m.composer.editExpired)
  const [circle] = await db.select({ id: circles.id }).from(circles).where(eq(circles.slug, d.circle))
  if (!circle) return fail(m.common.error)

  const level = detectCrisis(d.body, await getCrisisTerms())
  await db
    .update(posts)
    .set({
      body: d.body,
      need: d.need,
      circleId: circle.id,
      contentWarning: d.contentWarning,
      editedAt: new Date(),
      crisisLevel: level,
      ...(level === 'acute' ? { status: 'pending' as const } : {}),
    })
    .where(eq(posts.id, d.id))
  if (level === 'acute') await db.insert(reports).values({ targetType: 'post', targetId: d.id, reason: 'auto_acute', priority: 0 })
  await enqueue(QUEUES.moderate, { targetType: 'post', targetId: d.id }).catch((e) => console.error('[moderate] enqueue', e))
  return { ok: true, post: (await getPostById(v.userId, d.id))! }
}

/** Sofort und endgültig – inklusive der Antworten anderer darauf. */
export async function deletePost(id: string): Promise<Ok<object> | Fail> {
  const v = await getViewer()
  if (!v) return fail(m.common.sessionEnded)
  const ok = z.uuid().safeParse(id).success && (await hardDeletePost(id, v.userId))
  return ok ? { ok: true } : fail(m.common.error)
}

export async function setClosed(id: string, closed: boolean): Promise<Ok<object> | Fail> {
  const v = await getViewer()
  if (!v) return fail(m.common.sessionEnded)
  await db.update(posts).set({ closed }).where(and(eq(posts.id, id), eq(posts.userId, v.userId)))
  return { ok: true }
}

/* --------------------------------------------------------------- Zuspruch */

export async function toggleSupport(postId: string, kind: string): Promise<Ok<{ sent: boolean }> | Fail> {
  const v = await writer()
  if (isFail(v)) return v
  const k = z.enum(SUPPORT_KINDS).safeParse(kind)
  if (!k.success) return fail(m.common.error)
  const p = await visiblePost(v.userId, postId)
  if (!p || p.userId === v.userId) return fail(m.common.error)
  const removed = await db
    .delete(support)
    .where(and(eq(support.postId, postId), eq(support.userId, v.userId), eq(support.kind, k.data)))
    .returning({ k: support.kind })
  if (removed.length) return { ok: true, sent: false }
  await db.insert(support).values({ postId, userId: v.userId, kind: k.data }).onConflictDoNothing()
  await notifySupport(p.userId, postId, k.data, p.body)
  await touchPresence(v.userId, p.circleId)
  return { ok: true, sent: true }
}

/* -------------------------------------------------------------- Antworten */

export async function createReply(postId: string, body: string): Promise<Ok<{ reply: PublicReply; acute: boolean }> | Fail> {
  const v = await writer()
  if (isFail(v)) return v
  const text = z.string().trim().min(1).max(LIMITS.replyMax).safeParse(body)
  if (!text.success) return fail(m.common.error)
  const p = await visiblePost(v.userId, postId)
  if (!p) return fail(m.common.error)
  if (p.closed) return fail(m.replies.closed)

  const isNew = Date.now() - v.createdAt.getTime() < LIMITS.newAccountMs
  const [{ n } = { n: 0 }] = await db
    .select({ n: count() })
    .from(replies)
    .where(and(eq(replies.userId, v.userId), gt(replies.createdAt, new Date(Date.now() - DAY))))
  if (n >= (isNew ? LIMITS.repliesPerDayNew : LIMITS.repliesPerDay)) return fail(m.common.rateLimited)

  // Im Thread bleibt der Name konstant. Die Verfasserin erscheint immer unter dem Namen ihres Gedankens.
  const isAuthor = p.userId === v.userId
  let handle = v.displayName
  let seed = v.glyphSeed
  if (isAuthor) {
    handle = p.authorHandle
    seed = p.glyphSeed
  } else {
    const [earlier] = await db
      .select({ h: replies.authorHandle, s: replies.glyphSeed })
      .from(replies)
      .where(and(eq(replies.postId, postId), eq(replies.userId, v.userId)))
      .orderBy(replies.createdAt)
      .limit(1)
    if (earlier) {
      handle = earlier.h
      seed = earlier.s
    }
  }

  const level = detectCrisis(text.data, await getCrisisTerms())
  const status = level === 'acute' ? ('pending' as const) : ('visible' as const)
  const [r] = await db
    .insert(replies)
    .values({ postId, userId: v.userId, body: text.data, authorHandle: handle, glyphSeed: seed, isAuthor, status, crisisLevel: level })
    .returning()
  if (status === 'visible' && !isAuthor) await syncReplyCount(postId)
  if (level === 'acute') await db.insert(reports).values({ targetType: 'reply', targetId: r!.id, reason: 'auto_acute', priority: 0 })
  await enqueue(QUEUES.moderate, { targetType: 'reply', targetId: r!.id }).catch((e) => console.error('[moderate] enqueue', e))
  if (!isAuthor && status === 'visible') await notifyReply(p.userId, postId, p.body)
  await touchPresence(v.userId, p.circleId)
  return { ok: true, reply: toPublicReply({ ...r!, deletedAt: null }, v.userId, p.userId), acute: level === 'acute' }
}

async function ownReplyTarget(viewerId: string, replyId: string) {
  const [r] = await db
    .select({ id: replies.id, postOwner: posts.userId })
    .from(replies)
    .innerJoin(posts, eq(posts.id, replies.postId))
    .where(eq(replies.id, replyId))
  return r && r.postOwner === viewerId ? r : null
}

/** «Das hat mir gutgetan» – sieht nur die antwortende Person. */
export async function markHelpful(replyId: string, helpful: boolean): Promise<Ok<object> | Fail> {
  const v = await getViewer()
  if (!v) return fail(m.common.sessionEnded)
  if (!(await ownReplyTarget(v.userId, replyId))) return fail(m.common.error)
  await db.update(replies).set({ helpful }).where(eq(replies.id, replyId))
  return { ok: true }
}

export async function hideReply(replyId: string, hidden: boolean): Promise<Ok<object> | Fail> {
  const v = await getViewer()
  if (!v) return fail(m.common.sessionEnded)
  if (!(await ownReplyTarget(v.userId, replyId))) return fail(m.common.error)
  await db.update(replies).set({ hiddenByAuthor: hidden }).where(eq(replies.id, replyId))
  return { ok: true }
}

/**
 * Eigene Antwort löschen – etwa wenn man zu viel von sich preisgegeben hat. Der Text verschwindet sofort,
 * im Thread steht nur noch «gelöscht»; offene Meldungen dazu werden geschlossen.
 */
export async function deleteReply(replyId: string): Promise<Ok<object> | Fail> {
  const v = await getViewer()
  if (!v) return fail(m.common.sessionEnded)
  const id = z.uuid().safeParse(replyId)
  if (!id.success) return fail(m.common.error)
  const done = await db.transaction(async (tx) => {
    const [r] = await tx
      .update(replies)
      .set({ body: '', deletedAt: new Date() })
      .where(and(eq(replies.id, id.data), eq(replies.userId, v.userId), isNull(replies.deletedAt)))
      .returning({ postId: replies.postId })
    if (!r) return false
    await tx
      .update(reports)
      .set({ status: 'dismissed', resolvedAt: new Date() })
      .where(and(eq(reports.targetType, 'reply'), eq(reports.targetId, id.data), eq(reports.status, 'open')))
    await syncReplyCount(r.postId, tx)
    return true
  })
  return done ? { ok: true } : fail(m.common.error)
}

/* ------------------------------------------------------ Merken, Melden, Blockieren */

export async function toggleBookmark(postId: string): Promise<Ok<{ bookmarked: boolean }> | Fail> {
  const v = await getViewer()
  if (!v) return fail(m.common.sessionEnded)
  const removed = await db
    .delete(bookmarks)
    .where(and(eq(bookmarks.userId, v.userId), eq(bookmarks.postId, postId)))
    .returning({ p: bookmarks.postId })
  if (removed.length) return { ok: true, bookmarked: false }
  if (!(await visiblePost(v.userId, postId))) return fail(m.common.error)
  await db.insert(bookmarks).values({ userId: v.userId, postId }).onConflictDoNothing()
  return { ok: true, bookmarked: true }
}

async function targetOwner(type: 'post' | 'reply', id: string) {
  if (type === 'post') {
    const [p] = await db.select({ u: posts.userId }).from(posts).where(eq(posts.id, id))
    return p?.u ?? null
  }
  const [r] = await db.select({ u: replies.userId }).from(replies).where(eq(replies.id, id))
  return r?.u ?? null
}

const AUTO_HIDE_REPORTS = 3
/** Konten zählen fürs automatische Ausblenden erst ab diesem Alter. */
const REPORTER_MIN_AGE_MS = 3 * 24 * 60 * 60_000

export async function reportContent(input: { type: 'post' | 'reply'; id: string; reason: string; note?: string }): Promise<Ok<object> | Fail> {
  const v = await getViewer()
  if (!v) return fail(m.common.sessionEnded)
  const parsed = z
    .object({ type: z.enum(['post', 'reply']), id: z.uuid(), reason: z.enum(REPORT_REASONS), note: z.string().max(500).optional() })
    .safeParse(input)
  if (!parsed.success) return fail(m.common.error)
  const d = parsed.data
  // Melden ist wichtig, darf aber kein Werkzeug zum Wegdrücken werden.
  if (!(await hit(`report:${v.userId}`, 15, 60 * 60_000)).ok || !(await hit(`report-day:${v.userId}`, 40, 24 * 60 * 60_000)).ok)
    return fail(m.common.rateLimited)
  const owner = await targetOwner(d.type, d.id)
  if (!owner || owner === v.userId) return fail(m.common.error)
  await db
    .insert(reports)
    .values({ reporterId: v.userId, targetType: d.type, targetId: d.id, reason: d.reason, note: d.note?.trim() || null, priority: d.reason === 'worry' ? 1 : 2 })
    .onConflictDoNothing()

  // Ab 3 Meldungen verschiedener Konten wird der Inhalt bis zur Prüfung ausgeblendet – aber:
  // - «Ich mache mir Sorgen» zählt nicht: Sorge soll Hilfe holen, nicht den Gedanken verstecken, der Zuspruch braucht.
  // - Es zählen nur aktive Konten, die älter als drei Tage sind – frisch angelegte Wegwerfkonten verstecken nichts.
  const [{ n } = { n: 0 }] = await db
    .select({ n: sql<number>`count(DISTINCT ${reports.reporterId})::int` })
    .from(reports)
    .innerJoin(users, eq(users.id, reports.reporterId))
    .where(
      and(
        eq(reports.targetType, d.type),
        eq(reports.targetId, d.id),
        eq(reports.status, 'open'),
        ne(reports.reason, 'worry'),
        eq(users.status, 'active'),
        lt(users.createdAt, new Date(Date.now() - REPORTER_MIN_AGE_MS)),
      ),
    )
  if (n >= AUTO_HIDE_REPORTS) {
    if (d.type === 'post') await db.update(posts).set({ status: 'hidden' }).where(and(eq(posts.id, d.id), eq(posts.status, 'visible')))
    else {
      const [hidden] = await db
        .update(replies)
        .set({ status: 'hidden' })
        .where(and(eq(replies.id, d.id), eq(replies.status, 'visible')))
        .returning({ postId: replies.postId })
      if (hidden) await syncReplyCount(hidden.postId)
    }
  }
  return { ok: true }
}

/**
 * Blockieren unter Namen trifft das Konto. Bei anonymen Inhalten wird nur dieser Gedanke ausgeblendet:
 * ein Konto-Block liesse sich sonst durch Vergleichen des Feeds einer Person zuordnen.
 */
export async function blockAuthor(input: { type: 'post' | 'reply'; id: string }): Promise<Ok<object> | Fail> {
  const v = await getViewer()
  if (!v) return fail(m.common.sessionEnded)
  const parsed = z.object({ type: z.enum(['post', 'reply']), id: z.uuid() }).safeParse(input)
  if (!parsed.success) return fail(m.common.error)
  const { type, id } = parsed.data
  const [t] =
    type === 'post'
      ? await db.select({ owner: posts.userId, postId: posts.id, anonymous: sql<boolean>`${posts.visibility} = 'anonymous'` }).from(posts).where(eq(posts.id, id))
      : await db
          .select({ owner: replies.userId, postId: posts.id, anonymous: sql<boolean>`${replies.isAuthor} AND ${posts.visibility} = 'anonymous'` })
          .from(replies)
          .innerJoin(posts, eq(posts.id, replies.postId))
          .where(eq(replies.id, id))
  if (!t?.owner || t.owner === v.userId) return fail(m.common.error)
  if (t.anonymous) await db.insert(postHides).values({ userId: v.userId, postId: t.postId }).onConflictDoNothing()
  else await db.insert(blocks).values({ blockerId: v.userId, blockedId: t.owner }).onConflictDoNothing()
  return { ok: true }
}

/* ----------------------------------------------------------- Privater Raum */

export async function saveCheckin(input: { mood: number; note?: string }): Promise<Ok<{ proHint: boolean; letter: { body: string; createdAt: string } | null }> | Fail> {
  const v = await getViewer()
  if (!v) return fail(m.common.sessionEnded)
  const mood = z.number().int().min(0).max(4).safeParse(input.mood)
  if (!mood.success) return fail(m.common.error)
  const note = input.note?.trim().slice(0, LIMITS.noteMax) || null

  // Ein Check-in pro Stunde: innerhalb der Stunde wird der bestehende aktualisiert.
  const hourStart = new Date()
  hourStart.setMinutes(0, 0, 0)
  const [current] = await db
    .select({ id: checkins.id, note: checkins.note })
    .from(checkins)
    .where(and(eq(checkins.userId, v.userId), gte(checkins.createdAt, hourStart)))
    .limit(1)
  if (current) {
    await db.update(checkins).set({ mood: mood.data, note: note ?? current.note }).where(eq(checkins.id, current.id))
  } else {
    await db.insert(checkins).values({ userId: v.userId, mood: mood.data, note })
  }
  const heavy = mood.data === MOOD_HEAVY
  return { ok: true, proHint: heavy ? await shouldShowProHint(v) : false, letter: heavy ? await takeLetter(v.userId) : null }
}

/** Nach einem «Schwer»: der älteste noch nicht gezeigte Brief an sich selbst – jeder kommt genau einmal von allein. */
async function takeLetter(userId: string) {
  const [l] = await db
    .update(letters)
    .set({ shownAt: new Date() })
    .where(
      eq(
        letters.id,
        db
          .select({ id: letters.id })
          .from(letters)
          .where(and(eq(letters.userId, userId), isNull(letters.shownAt)))
          .orderBy(letters.createdAt)
          .limit(1),
      ),
    )
    .returning({ body: letters.body, createdAt: letters.createdAt })
  return l ? { body: l.body, createdAt: l.createdAt.toISOString() } : null
}

/** Drei Tage in Folge «Schwer»: einmalig ein behutsamer Hinweis, nicht öfter als alle 7 Tage. */
async function shouldShowProHint(v: Viewer) {
  const last = v.settings.proHelpHintAt ? Date.parse(v.settings.proHelpHintAt) : 0
  if (Date.now() - last < 7 * DAY) return false
  const rows = await db
    .select({ createdAt: checkins.createdAt })
    .from(checkins)
    .where(and(eq(checkins.userId, v.userId), eq(checkins.mood, MOOD_HEAVY), gt(checkins.createdAt, new Date(Date.now() - 3 * DAY - 60 * 60 * 1000))))
  const days = new Set(rows.map((r) => zurichDay(r.createdAt)))
  const needed = [0, 1, 2].map((i) => zurichDay(new Date(Date.now() - i * DAY)))
  if (!needed.every((d) => days.has(d))) return false
  await db
    .update(profiles)
    .set({ settings: { ...v.settings, proHelpHintAt: new Date().toISOString() } })
    .where(eq(profiles.userId, v.userId))
  return true
}

export async function logBreath(seconds: number) {
  const v = await getViewer()
  if (!v) return
  const s = Math.max(1, Math.min(600, Math.round(seconds)))
  await db.insert(breathLog).values({ userId: v.userId, seconds: s })
}

export type StepView = { id: string; text: string; done: boolean } | null

/** Täglich ein Vorschlag. «Ein anderer» geht weiter, ohne Streaks, ohne Strafe. */
export async function currentStep(): Promise<StepView> {
  const v = await getViewer()
  if (!v) return null
  return pickStep(v.userId)
}

async function pickStep(userId: string): Promise<StepView> {
  const muted = db
    .select({ id: circlePrefs.circleId })
    .from(circlePrefs)
    .where(and(eq(circlePrefs.userId, userId), eq(circlePrefs.state, 'mute')))
  const list = await db
    .select({ id: steps.id, text: steps.text, circleId: steps.circleId })
    .from(steps)
    .where(and(eq(steps.isActive, true), or(isNull(steps.circleId), notInArray(steps.circleId, muted))))
    .orderBy(steps.sort)
  if (!list.length) return null
  const today = zurichDay()
  const since = new Date(Date.now() - DAY)
  const log = await db
    .select({ stepId: stepLog.stepId, action: stepLog.action, createdAt: stepLog.createdAt })
    .from(stepLog)
    .where(and(eq(stepLog.userId, userId), gt(stepLog.createdAt, since)))
    .orderBy(desc(stepLog.createdAt))
  const todays = log.filter((l) => zurichDay(l.createdAt) === today)
  const doneToday = todays.find((l) => l.action === 'done')
  if (doneToday) {
    const s = list.find((x) => x.id === doneToday.stepId)
    if (s) return { id: s.id, text: s.text, done: true }
  }
  const skips = todays.filter((l) => l.action === 'skip').length
  const dayNo = Math.floor(Date.parse(`${today}T00:00:00Z`) / DAY)
  const s = list[(dayNo + skips) % list.length]!
  return { id: s.id, text: s.text, done: false }
}

export async function stepAction(stepId: string, action: 'done' | 'skip'): Promise<StepView> {
  const v = await getViewer()
  if (!v) return null
  if (!z.uuid().safeParse(stepId).success || !['done', 'skip'].includes(action)) return pickStep(v.userId)
  await db.insert(stepLog).values({ userId: v.userId, stepId, action })
  return pickStep(v.userId)
}

/* -------------------------------------------------------------- Feed */

export async function loadFeed(view: FeedView, circleSlug: string | null, cursor: string | null): Promise<FeedPage | null> {
  const v = await getViewer()
  if (!v) return null
  const safeView: FeedView = view === 'unheard' || view === 'brave' ? view : 'all'
  let circleId: string | null = null
  if (circleSlug) {
    const [c] = await db.select({ id: circles.id }).from(circles).where(eq(circles.slug, circleSlug))
    circleId = c?.id ?? null
  }
  return getFeed({ viewerId: v.userId, view: safeView, circleId, cursor })
}

/** «Ein Gedanke wartet»: der nächste unbeantwortete Gedanke – genau einer, ohne Liste und ohne Zahlen. */
export async function nextWaiting(cursor: string | null): Promise<{ post: PublicPost | null; cursor: string | null } | null> {
  const v = await getViewer()
  if (!v) return null
  const page = await getFeed({ viewerId: v.userId, view: 'unheard', cursor, size: 1 })
  return { post: page.posts[0] ?? null, cursor: page.nextCursor }
}

export async function setCirclePref(slug: string, state: 'follow' | 'mute' | null): Promise<Ok<object> | Fail> {
  const v = await getViewer()
  if (!v) return fail(m.common.sessionEnded)
  const [c] = await db.select({ id: circles.id }).from(circles).where(eq(circles.slug, slug))
  if (!c) return fail(m.common.error)
  if (state === null) {
    await db.delete(circlePrefs).where(and(eq(circlePrefs.userId, v.userId), eq(circlePrefs.circleId, c.id)))
  } else {
    await db
      .insert(circlePrefs)
      .values({ userId: v.userId, circleId: c.id, state })
      .onConflictDoUpdate({ target: [circlePrefs.userId, circlePrefs.circleId], set: { state } })
  }
  return { ok: true }
}

/* --------------------------------------------------------- Benachrichtigungen */

export type ClientNotification = {
  id: string
  kind: 'reply' | 'support' | 'moderation' | 'system'
  postId: string | null
  postDeleted: boolean
  count: number
  excerpt: string | null
  message: string | null
  read: boolean
  createdAt: string
}

export async function listNotifications(): Promise<ClientNotification[]> {
  const v = await getViewer()
  if (!v) return []
  const rows = await db
    .select({
      id: notifications.id,
      kind: notifications.kind,
      postId: notifications.postId,
      payload: notifications.payload,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
      deletedAt: posts.deletedAt,
    })
    .from(notifications)
    .leftJoin(posts, eq(posts.id, notifications.postId))
    .where(eq(notifications.userId, v.userId))
    .orderBy(desc(notifications.createdAt))
    .limit(50)
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    postId: r.deletedAt ? null : r.postId,
    postDeleted: Boolean(r.deletedAt) || (r.kind !== 'moderation' && r.kind !== 'system' && !r.postId),
    count: r.payload.count ?? 1,
    excerpt: r.payload.excerpt ?? null,
    message: r.payload.message ?? null,
    read: Boolean(r.readAt),
    createdAt: r.createdAt.toISOString(),
  }))
}

export async function markNotificationsRead(): Promise<void> {
  const v = await getViewer()
  if (!v) return
  await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, v.userId), isNull(notifications.readAt)))
}

export async function unreadState(): Promise<{ unread: number; supportSinceLastVisit: boolean }> {
  const v = await getViewer()
  if (!v) return { unread: 0, supportSinceLastVisit: false }
  const rows = await db
    .select({ kind: notifications.kind })
    .from(notifications)
    .where(and(eq(notifications.userId, v.userId), isNull(notifications.readAt)))
  return { unread: rows.length, supportSinceLastVisit: rows.some((r) => r.kind === 'support') }
}

/** Für die Kreis-Liste: Mitglieder der letzten 15 Minuten, auf 5 gerundet, unter 5 «ein paar». */
export async function presenceCounts(): Promise<Record<string, number | null>> {
  const rows = await db.execute<{ slug: string; n: number }>(sql`
    SELECT c.slug, count(p.user_id)::int AS n
    FROM circles c LEFT JOIN circle_presence p ON p.circle_id = c.id AND p.seen_at > now() - interval '15 minutes'
    GROUP BY c.slug`)
  const out: Record<string, number | null> = {}
  for (const r of rows.rows) out[r.slug] = r.n === 0 ? 0 : r.n < 5 ? null : Math.round(r.n / 5) * 5
  return out
}

export async function touchCircle(slug: string) {
  const v = await getViewer()
  if (!v) return
  const [c] = await db.select({ id: circles.id }).from(circles).where(eq(circles.slug, slug))
  if (c) await touchPresence(v.userId, c.id)
}

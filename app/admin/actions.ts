'use server'

import { and, eq, inArray, ne, sql } from 'drizzle-orm'
import { refresh, updateTag } from 'next/cache'
import { z } from 'zod'
import { db } from '@/db'
import {
  caseClaims,
  circles,
  crisisTerms,
  helpResources,
  moderationActions,
  postMedia,
  posts,
  replies,
  reports,
  sessions,
  steps,
  users,
} from '@/db/schema'
import { processMedia, rejectMedia } from '@/lib/media'
import { syncReplyCount } from '@/lib/reply-count'
import { assertModerator, canModerate, memberFromToken } from '@/lib/server/admin'
import { notifyModeration } from '@/lib/server/notify'
import { m } from '@/messages'

const ACTIONS = ['approve', 'care', 'hide', 'cw', 'warn', 'mute24', 'mute7', 'ban', 'dismiss'] as const
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
  if (['mute24', 'mute7', 'ban', 'warn'].includes(action) && target.userId) {
    const [u] = await db.select({ role: users.role }).from(users).where(eq(users.id, target.userId))
    if (u && u.role !== 'member' && !canModerate(mod, 'admin')) throw new Error('forbidden')
  }

  const setStatus = async (status: 'visible' | 'hidden') => {
    if (targetType === 'post') await db.update(posts).set({ status, moderationNote: status === 'hidden' ? reason || null : null }).where(eq(posts.id, targetId))
    else {
      await db.update(replies).set({ status }).where(eq(replies.id, targetId))
      // Neu gezählt statt ±1: Freigeben, Ausblenden und erneutes Freigeben ergeben immer den richtigen Wert.
      await syncReplyCount(target.postId)
    }
  }

  switch (action) {
    case 'approve':
    // «Gesehen · Fürsorge senden»: wie Freigeben, dazu eine ruhige Nachricht mit den Hilfe-Nummern an die Person.
    case 'care':
      await setStatus('visible')
      break
    case 'hide':
      await setStatus('hidden')
      break
    case 'cw':
      // Nur der Hinweis – sichtbar schaltet allein «Freigeben» (Rolle mod).
      if (targetType === 'post') await db.update(posts).set({ contentWarning: true }).where(eq(posts.id, targetId))
      break
    case 'mute24':
    case 'mute7':
      if (target.userId) {
        const hours = action === 'mute24' ? 24 : 24 * 7
        const until = new Date(Date.now() + hours * 3600_000)
        // Nur aktive oder schon stumme Konten: Eine Sperre oder eine laufende Löschung darf nicht zu «stumm» werden
        // (sonst wäre die Sperre nach Ablauf aufgehoben und die Löschung fände nie statt). Läuft schon eine längere
        // Stummschaltung, bleibt die längere.
        await db
          .update(users)
          .set({ status: 'muted', mutedUntil: sql`GREATEST(COALESCE(${users.mutedUntil}, now()), ${until})` })
          .where(and(eq(users.id, target.userId), inArray(users.status, ['active', 'muted'])))
      }
      break
    case 'ban':
      if (target.userId) {
        // Eine beantragte Löschung bleibt bestehen (deleteAfter wird nicht angetastet) – der Worker löscht auch
        // gesperrte Konten, deren Frist abgelaufen ist.
        await db.update(users).set({ status: 'banned', mutedUntil: null }).where(eq(users.id, target.userId))
        await db.delete(sessions).where(eq(sessions.userId, target.userId))
      }
      break
  }

  // Akute Krisen-Treffer bleiben offen, bis eine Moderatorin (mod) sie gesehen hat.
  const peerOnly = !canModerate(mod, 'mod')
  await db
    .update(reports)
    .set({ status: action === 'dismiss' ? 'dismissed' : 'resolved', resolvedAt: new Date() })
    .where(
      and(
        eq(reports.targetType, targetType),
        eq(reports.targetId, targetId),
        eq(reports.status, 'open'),
        ...(peerOnly ? [ne(reports.reason, 'auto_acute')] : []),
      ),
    )

  await db.insert(moderationActions).values({ moderatorId: mod.userId, targetType, targetId, action, reason: reason || null })
  // Erledigt – die Übernahme gibt den Fall frei.
  await db.delete(caseClaims).where(and(eq(caseClaims.targetType, targetType), eq(caseClaims.targetId, targetId)))
  if (target.userId && ['mute24', 'mute7', 'ban'].includes(action)) {
    await db.insert(moderationActions).values({ moderatorId: mod.userId, targetType: 'user', targetId: target.userId, action, reason: reason || null })
  }
  const message = MESSAGES[action]?.(reason)
  if (message && target.userId)
    await notifyModeration(target.userId, targetType === 'post' ? targetId : target.postId, message, ['hide', 'warn', 'mute24', 'mute7'].includes(action))
  refresh()
}

/* ----------------------------------------------------------- Übernahme */

/** Wie lange eine Übernahme gilt – danach darf jemand anderes den Fall nehmen. */
const CLAIM_MS = 20 * 60_000

/** Fall übernehmen: nur wenn frei, abgelaufen oder schon der eigene (dann verlängert). */
export async function claimCase(form: FormData) {
  const parsed = z.object({ targetType: z.enum(['post', 'reply']), targetId: z.uuid() }).safeParse(Object.fromEntries(form))
  if (!parsed.success) throw new Error('invalid')
  const mod = await assertModerator('peer')
  const { targetType, targetId } = parsed.data
  await db
    .insert(caseClaims)
    .values({ targetType, targetId, userId: mod.userId })
    .onConflictDoUpdate({
      target: [caseClaims.targetType, caseClaims.targetId],
      set: { userId: mod.userId, claimedAt: new Date() },
      setWhere: sql`${caseClaims.userId} = ${mod.userId} OR ${caseClaims.claimedAt} < ${new Date(Date.now() - CLAIM_MS)}`,
    })
  refresh()
}

/* --------------------------------------------------- Einspruch & Konto */

/** Einspruch entscheiden: Die Person bekommt die Antwort in die Glocke; die Massnahme selbst ändert man auf der Kontoseite. */
export async function resolveAppeal(form: FormData) {
  const parsed = z
    .object({ reportId: z.uuid(), decision: z.enum(['accept', 'reject']), reason: z.string().max(500).optional() })
    .safeParse(Object.fromEntries(form))
  if (!parsed.success) throw new Error('invalid')
  const { reportId, decision } = parsed.data
  const reason = parsed.data.reason?.trim() ?? ''
  const mod = await assertModerator('mod')
  const [r] = await db
    .update(reports)
    .set({ status: decision === 'accept' ? 'resolved' : 'dismissed', resolvedAt: new Date() })
    .where(and(eq(reports.id, reportId), eq(reports.targetType, 'user'), eq(reports.status, 'open')))
    .returning({ userId: reports.targetId })
  if (!r) return refresh()
  await db.insert(moderationActions).values({
    moderatorId: mod.userId,
    targetType: 'user',
    targetId: r.userId,
    action: decision === 'accept' ? 'appeal_accept' : 'appeal_reject',
    reason: reason || null,
  })
  await notifyModeration(r.userId, null, decision === 'accept' ? m.appeal.accepted(reason) : m.appeal.rejected(reason))
  refresh()
}

/** Stummschaltung (mod) oder Sperre (admin) aufheben – bisher ging das nur direkt in der Datenbank. */
export async function restoreAccount(form: FormData) {
  const parsed = z
    .object({ token: z.string().max(400), action: z.enum(['unmute', 'unban']), reason: z.string().max(500).optional() })
    .safeParse(Object.fromEntries(form))
  if (!parsed.success) throw new Error('invalid')
  const userId = memberFromToken(parsed.data.token)
  if (!userId) throw new Error('invalid')
  const { action } = parsed.data
  const reason = parsed.data.reason?.trim() ?? ''
  const mod = await assertModerator(action === 'unban' ? 'admin' : 'mod')
  const [changed] = await db
    .update(users)
    .set({ status: 'active', mutedUntil: null })
    .where(and(eq(users.id, userId), eq(users.status, action === 'unban' ? 'banned' : 'muted')))
    .returning({ id: users.id })
  if (!changed) return refresh()
  await db.insert(moderationActions).values({ moderatorId: mod.userId, targetType: 'user', targetId: userId, action, reason: reason || null })
  await notifyModeration(userId, null, action === 'unban' ? m.admin.account.unbanned : m.admin.account.unmuted)
  refresh()
}

/* ------------------------------------------------------------- Bilder */

/**
 * Bildfreigabe. Ein Bild, das der Worker schon bereinigt hat (`review`), wird nur sichtbar geschaltet.
 * Hängt es noch in der Quarantäne, wird es jetzt hier bereinigt (EXIF/GPS weg, neu kodiert) und direkt freigegeben.
 */
export async function reviewImage(form: FormData): Promise<void> {
  const parsed = z
    .object({ mediaId: z.uuid(), decision: z.enum(['approve', 'reject']), reason: z.string().max(500).optional() })
    .safeParse(Object.fromEntries(form))
  if (!parsed.success) throw new Error('invalid')
  const { mediaId, decision } = parsed.data
  const reason = parsed.data.reason?.trim() ?? ''
  const mod = await assertModerator('mod')

  const [row] = await db
    .select({ status: postMedia.status, postId: postMedia.postId, userId: postMedia.userId })
    .from(postMedia)
    .where(eq(postMedia.id, mediaId))
  if (!row?.postId || (row.status !== 'quarantine' && row.status !== 'review')) return refresh()

  // Freigeben nur, was die Moderation bereinigt gesehen hat.
  if (decision === 'approve' && row.status !== 'review') return refresh()
  // Wirkt nur, wenn der Status noch stimmt – zwei Moderator:innen oder der Worker gleichzeitig ändern nichts doppelt.
  let changed: boolean
  if (decision === 'reject') changed = await rejectMedia(mediaId, `Moderation${reason ? `: ${reason}` : ''}`)
  else {
    const done = await db
      .update(postMedia)
      .set({ status: 'ready' })
      .where(and(eq(postMedia.id, mediaId), eq(postMedia.status, 'review')))
      .returning({ id: postMedia.id })
    changed = done.length > 0
  }
  if (!changed) return refresh()
  const result = decision === 'approve' ? 'ready' : 'rejected'

  await db.insert(moderationActions).values({
    moderatorId: mod.userId,
    targetType: 'post',
    targetId: row.postId,
    action: result === 'ready' ? 'image_approve' : 'image_reject',
    reason: reason || null,
  })
  await notifyModeration(row.userId, row.postId, result === 'ready' ? m.admin.images.approvedNote : m.admin.images.rejectedNote(decision === 'reject' ? reason : ''))
  refresh()
}

/** Bereinigt ein Bild, das der Worker (noch) nicht verarbeitet hat – danach erst gibt es eine Vorschau. */
export async function cleanImage(form: FormData): Promise<void> {
  const mediaId = z.uuid().safeParse(form.get('mediaId'))
  if (!mediaId.success) throw new Error('invalid')
  await assertModerator('mod')
  // Bucket oder Anbieter kurz weg: Bild bleibt in der Quarantäne, die Seite zeigt es weiter an.
  await processMedia(mediaId.data, 'review').catch((e) => console.error(`[media] ${mediaId.data} bereinigen fehlgeschlagen:`, (e as Error).message))
  refresh()
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
  if (d.id && d.remove) await db.update(crisisTerms).set({ active: false }).where(eq(crisisTerms.id, d.id))
  else
    await db
      .insert(crisisTerms)
      .values({ term: d.term.toLowerCase(), level: d.level })
      .onConflictDoUpdate({ target: [crisisTerms.language, crisisTerms.term], set: { level: d.level, active: true } })
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

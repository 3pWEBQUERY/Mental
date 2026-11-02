'use server'

import { and, count, eq, inArray, isNull, ne, sql } from 'drizzle-orm'
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
  roleProposals,
  sessions,
  steps,
  users,
} from '@/db/schema'
import { processMedia, rejectMedia } from '@/lib/media'
import { syncReplyCount } from '@/lib/reply-count'
import { assertModerator, canModerate, memberFromToken, ROLE_PROPOSAL_DAYS } from '@/lib/server/admin'
import { notifyAdmins, notifyModeration, notifyReply, notifySystem } from '@/lib/server/notify'
import { m, type Messages } from '@/messages'
import { safeMessage } from '@/lib/log-safe'
import type { AdminResult } from '@/lib/admin-result'

const ACTIONS = ['approve', 'care', 'hide', 'cw', 'warn', 'mute24', 'mute7', 'ban', 'dismiss'] as const
type Action = (typeof ACTIONS)[number]
/** Peer-Moderator:innen: nur ausblenden und Inhaltshinweis, keine Sperren. */
const PEER_ACTIONS: Action[] = ['hide', 'cw']

/** Nachricht an die betroffene Person je Massnahme – in ihrer Sprache (siehe notifyModeration). */
const notice = (action: Action, reason: string) => {
  if (!(action in m.admin.notify)) return null
  return (t: Messages) => (t.admin.notify as Partial<Record<Action, (r: string) => string>>)[action]!(reason)
}

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
    if (u && u.role !== 'member') {
      if (!canModerate(mod, 'admin')) throw new Error('forbidden')
      // Moderationskonten nie direkt stummschalten oder sperren: Ein einzelnes (vielleicht übernommenes) Admin-Konto
      // könnte sonst alle anderen aussperren. Erst über «Rollen» herabstufen – das braucht zwei Admins.
      if (action !== 'warn') throw new Error('forbidden')
    }
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
    case 'care': {
      const [before] =
        targetType === 'reply'
          ? await db.select({ status: replies.status, isAuthor: replies.isAuthor }).from(replies).where(eq(replies.id, targetId))
          : []
      await setStatus('visible')
      // Eine zurückgehaltene Antwort ist jetzt sichtbar: Die Person, die den Gedanken geteilt hat, erfährt es –
      // wie bei einer Antwort, die sofort sichtbar war.
      if (before && before.status !== 'visible' && !before.isAuthor) {
        const [p] = await db
          .select({ userId: posts.userId, body: posts.body })
          .from(posts)
          .where(and(eq(posts.id, target.postId), isNull(posts.deletedAt)))
        if (p) await notifyReply(p.userId, target.postId, p.body).catch((e) => console.error('[notify] Freigabe', safeMessage(e)))
      }
      break
    }
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
  const message = notice(action, reason)
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
  await notifyModeration(r.userId, null, (t) => (decision === 'accept' ? t.appeal.accepted(reason) : t.appeal.rejected(reason)))
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
  await notifyModeration(userId, null, (t) => (action === 'unban' ? t.admin.account.unbanned : t.admin.account.unmuted))
  refresh()
}

/* ------------------------------------------------------------- Rollen */

const ROLES = ['member', 'peer_mod', 'mod', 'admin'] as const

/**
 * Rollenwechsel, Schritt 1: Ein Admin schlägt vor. Wirksam wird er erst, wenn ein zweiter Admin bestätigt
 * (Vier-Augen-Prinzip) – sonst könnte ein übernommenes Admin-Konto allein neue Admins ernennen.
 */
export async function proposeRole(form: FormData) {
  const parsed = z
    .object({ token: z.string().max(400), role: z.enum(ROLES), reason: z.string().trim().min(3).max(500) })
    .safeParse(Object.fromEntries(form))
  if (!parsed.success) throw new Error('invalid')
  const userId = memberFromToken(parsed.data.token)
  if (!userId) throw new Error('invalid')
  const admin = await assertModerator('admin')
  if (userId === admin.userId) throw new Error('forbidden')
  const [u] = await db.select({ role: users.role, status: users.status }).from(users).where(eq(users.id, userId))
  if (!u || u.role === parsed.data.role) return refresh()
  // Gesperrte oder gelöschte Konten bekommen keine Rolle.
  if (parsed.data.role !== 'member' && u.status !== 'active') throw new Error('forbidden')
  const { role, reason } = parsed.data
  await db
    .insert(roleProposals)
    .values({ userId, role, proposedBy: admin.userId, reason })
    .onConflictDoUpdate({ target: roleProposals.userId, set: { role, proposedBy: admin.userId, reason, createdAt: new Date() } })
  await audit(admin.userId, 'role_propose', userId, `${u.role} → ${role}: ${reason}`)
  await notifyAdmins((t) => t.admin.roles.proposedNotice, admin.userId)
  refresh()
}

/** Rollenwechsel, Schritt 2: ein anderer Admin bestätigt – oder jemand (auch die vorschlagende Person) verwirft. */
export async function decideRole(form: FormData) {
  const parsed = z
    .object({ token: z.string().max(400), decision: z.enum(['accept', 'reject']) })
    .safeParse(Object.fromEntries(form))
  if (!parsed.success) throw new Error('invalid')
  const userId = memberFromToken(parsed.data.token)
  if (!userId) throw new Error('invalid')
  const admin = await assertModerator('admin')
  const { decision } = parsed.data
  const result = await db.transaction(async (tx) => {
    const [p] = await tx.select().from(roleProposals).where(eq(roleProposals.userId, userId)).for('update')
    if (!p) return null
    await tx.delete(roleProposals).where(eq(roleProposals.userId, userId))
    const expired = p.createdAt.getTime() < Date.now() - ROLE_PROPOSAL_DAYS * 86_400_000
    if (decision === 'reject' || expired) return { p, applied: false, from: null }
    // Wer vorgeschlagen hat, kann nicht selbst bestätigen – auch nicht für sich selbst als Ziel.
    if (p.proposedBy === admin.userId || userId === admin.userId) throw new Error('forbidden')
    const [u] = await tx.select({ role: users.role, status: users.status }).from(users).where(eq(users.id, userId)).for('update')
    if (!u || (p.role !== 'member' && u.status !== 'active')) return { p, applied: false, from: null }
    await tx.update(users).set({ role: p.role }).where(eq(users.id, userId))
    // Weniger Rechte: übernommene Fälle freigeben, damit nichts bei jemandem hängen bleibt, der nicht mehr moderiert.
    if (p.role === 'member') await tx.delete(caseClaims).where(eq(caseClaims.userId, userId))
    return { p, applied: true, from: u.role }
  })
  if (!result) return refresh()
  const { p, applied, from } = result
  await audit(admin.userId, applied ? 'role_accept' : 'role_reject', userId, applied ? `${from} → ${p.role}` : p.role)
  if (applied) {
    await notifySystem([userId], (t) => t.admin.roles.changedNotice(t.admin.account.roles[p.role]))
    await notifyAdmins((t) => t.admin.roles.appliedNotice(t.admin.account.roles[p.role]), admin.userId)
  }
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
  await notifyModeration(row.userId, row.postId, (t) =>
    result === 'ready' ? t.admin.images.approvedNote : t.admin.images.rejectedNote(decision === 'reject' ? reason : ''),
  )
  refresh()
}

/** Bereinigt ein Bild, das der Worker (noch) nicht verarbeitet hat – danach erst gibt es eine Vorschau. */
export async function cleanImage(form: FormData): Promise<void> {
  const mediaId = z.uuid().safeParse(form.get('mediaId'))
  if (!mediaId.success) throw new Error('invalid')
  await assertModerator('mod')
  // Bucket oder Anbieter kurz weg: Bild bleibt in der Quarantäne, die Seite zeigt es weiter an.
  await processMedia(mediaId.data, 'review').catch((e) => console.error(`[media] ${mediaId.data} bereinigen fehlgeschlagen:`, safeMessage(e)))
  refresh()
}

/* ------------------------------------------------------------- Listen */

async function audit(moderatorId: string, action: string, targetId: string, reason?: string) {
  await db.insert(moderationActions).values({ moderatorId, targetType: 'user', targetId, action, reason: reason ?? null })
}

const str = (max: number) => z.string().trim().min(1).max(max)

const done = (message: string): AdminResult => ({ ok: true, message })
const nope = (error: string): AdminResult => ({ ok: false, error })
const INVALID = 'Bitte die Felder prüfen – etwas fehlt oder ist zu lang.'
const optional = (max: number) => z.string().trim().max(max).optional()

/** Kreise, Hilfe-Nummern und Schritte: Jede Änderung gilt sofort – im Cache aller Replikas (cache-handlers/default.cjs) und auf dieser Seite. */
function changed(tag?: 'circles' | 'help') {
  if (tag) updateTag(tag)
  refresh()
}

export async function saveCircle(form: FormData): Promise<AdminResult> {
  const admin = await assertModerator('admin')
  const parsed = z
    .object({
      id: z.uuid().optional().or(z.literal('')),
      slug: z.string().trim().regex(/^[a-z0-9-]{2,40}$/),
      name: str(40),
      description: str(400),
      rules: str(400),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      sort: z.coerce.number().int().min(0).max(999),
      isActive: z.string().optional(),
      requireCw: z.string().optional(),
      nameFr: optional(40),
      descriptionFr: optional(400),
      rulesFr: optional(400),
      nameIt: optional(40),
      descriptionIt: optional(400),
      rulesIt: optional(400),
    })
    .safeParse(Object.fromEntries(form))
  if (!parsed.success)
    return nope(parsed.error.issues.some((i) => i.path[0] === 'slug') ? 'Kurzname: 2–40 Zeichen, nur a–z, 0–9 und Bindestrich.' : INVALID)
  const d = parsed.data
  const fr = { name: d.nameFr || undefined, description: d.descriptionFr || undefined, rules: d.rulesFr || undefined }
  const it = { name: d.nameIt || undefined, description: d.descriptionIt || undefined, rules: d.rulesIt || undefined }
  const has = (t: typeof fr) => Boolean(t.name || t.description || t.rules)
  const values = {
    slug: d.slug,
    name: d.name,
    description: d.description,
    rules: d.rules,
    color: d.color,
    sort: d.sort,
    isActive: d.isActive === 'on',
    requireCw: d.requireCw === 'on',
    i18n: { ...(has(fr) ? { fr } : {}), ...(has(it) ? { it } : {}) },
  }
  const [taken] = await db
    .select({ id: circles.id })
    .from(circles)
    .where(d.id ? and(eq(circles.slug, d.slug), ne(circles.id, d.id)) : eq(circles.slug, d.slug))
  if (taken) return nope(`Den Kurznamen «${d.slug}» hat schon ein anderer Kreis.`)
  if (d.id) {
    // Ohne aktiven Kreis kann niemand mehr etwas schreiben.
    if (!values.isActive && !(await otherActiveCircle(d.id))) return nope('Mindestens ein Kreis muss aktiv bleiben.')
    const [row] = await db.update(circles).set(values).where(eq(circles.id, d.id)).returning({ id: circles.id })
    if (!row) return nope('Diesen Kreis gibt es nicht mehr.')
  } else await db.insert(circles).values(values)
  await audit(admin.userId, d.id ? 'circle:update' : 'circle:create', admin.userId, d.slug)
  changed('circles')
  return done(d.id ? `Kreis «${d.name}» gespeichert.` : `Kreis «${d.name}» angelegt.`)
}

async function otherActiveCircle(id: string) {
  const [other] = await db
    .select({ id: circles.id })
    .from(circles)
    .where(and(ne(circles.id, id), eq(circles.isActive, true)))
    .limit(1)
  return Boolean(other)
}

/**
 * Kreis löschen. Gedanken bleiben erhalten: Hat der Kreis welche, wandern sie in den gewählten Kreis.
 * Schritte des Kreises gelten danach für alle Kreise, Folgen/Stummschalten und «gerade hier» entfallen.
 */
export async function deleteCircle(form: FormData): Promise<AdminResult> {
  const admin = await assertModerator('admin')
  const parsed = z.object({ id: z.uuid(), moveTo: z.uuid().optional().or(z.literal('')) }).safeParse(Object.fromEntries(form))
  if (!parsed.success) return nope(INVALID)
  const { id, moveTo } = parsed.data
  const result = await db.transaction(async (tx) => {
    const [c] = await tx.select({ name: circles.name, slug: circles.slug, requireCw: circles.requireCw }).from(circles).where(eq(circles.id, id)).for('update')
    if (!c) return nope('Diesen Kreis gibt es nicht mehr.')
    const [other] = await tx
      .select({ id: circles.id })
      .from(circles)
      .where(and(ne(circles.id, id), eq(circles.isActive, true)))
      .limit(1)
    if (!other) return nope('Der letzte aktive Kreis lässt sich nicht löschen.')
    const [{ n } = { n: 0 }] = await tx.select({ n: count() }).from(posts).where(eq(posts.circleId, id))
    if (n > 0) {
      if (!moveTo || moveTo === id) return nope(`Der Kreis hat ${n} Gedanken. Wähle, in welchen Kreis sie kommen.`)
      const [target] = await tx.select({ id: circles.id }).from(circles).where(and(eq(circles.id, moveTo), eq(circles.isActive, true)))
      if (!target) return nope('Wähle einen aktiven Kreis, in den die Gedanken kommen.')
      // Gedanken aus einem Kreis mit Pflicht-Inhaltshinweis behalten ihn im neuen Kreis.
      await tx
        .update(posts)
        .set({ circleId: moveTo, ...(c.requireCw ? { contentWarning: true } : {}) })
        .where(eq(posts.circleId, id))
    }
    await tx.delete(circles).where(eq(circles.id, id))
    return done(n > 0 ? `Kreis «${c.name}» gelöscht, ${n} Gedanken verschoben.` : `Kreis «${c.name}» gelöscht.`)
  })
  if (!result.ok) return result
  await audit(admin.userId, 'circle:delete', admin.userId, id)
  changed('circles')
  return result
}

const helpSchema = z.object({
  id: z.uuid().optional().or(z.literal('')),
  name: str(80),
  phone: z.string().trim().max(20).regex(/^[0-9+ ()\/-]*$/).optional(),
  url: z.url({ protocol: /^https?$/ }).optional().or(z.literal('')),
  hours: str(80),
  audience: str(120),
  sort: z.coerce.number().int().min(0).max(999),
  language: z.enum(['de', 'fr', 'it']).default('de'),
  circleId: z.uuid().optional().or(z.literal('')),
})

export async function saveHelp(form: FormData): Promise<AdminResult> {
  const admin = await assertModerator('admin')
  const parsed = helpSchema.safeParse(Object.fromEntries(form))
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0]
    return nope(field === 'url' ? 'Der Link muss mit https:// beginnen.' : field === 'phone' ? 'Nummer: nur Ziffern, Leerzeichen und + ( ) / -' : INVALID)
  }
  const d = parsed.data
  if (!d.phone && !d.url) return nope('Bitte eine Nummer oder einen Link angeben.')
  if (d.circleId) {
    const [c] = await db.select({ id: circles.id }).from(circles).where(eq(circles.id, d.circleId))
    if (!c) return nope('Den gewählten Kreis gibt es nicht mehr.')
  }
  const values = {
    name: d.name,
    phone: d.phone || null,
    url: d.url || null,
    hours: d.hours,
    audience: d.audience,
    sort: d.sort,
    language: d.language,
    circleId: d.circleId || null,
  }
  if (d.id) {
    const [row] = await db.update(helpResources).set(values).where(eq(helpResources.id, d.id)).returning({ id: helpResources.id })
    if (!row) return nope('Diesen Eintrag gibt es nicht mehr.')
  } else await db.insert(helpResources).values(values)
  await audit(admin.userId, d.id ? 'help:update' : 'help:create', admin.userId, d.name)
  changed('help')
  return done(d.id ? `«${d.name}» gespeichert.` : `«${d.name}» hinzugefügt.`)
}

export async function deleteHelp(form: FormData): Promise<AdminResult> {
  const admin = await assertModerator('admin')
  const id = z.uuid().safeParse(form.get('id'))
  if (!id.success) return nope(INVALID)
  const [row] = await db.delete(helpResources).where(eq(helpResources.id, id.data)).returning({ name: helpResources.name })
  if (!row) return nope('Diesen Eintrag gibt es nicht mehr.')
  await audit(admin.userId, 'help:delete', admin.userId, row.name)
  changed('help')
  return done(`«${row.name}» gelöscht.`)
}

export async function saveTerm(form: FormData) {
  const admin = await assertModerator('admin')
  const d = z
    .object({
      term: str(80),
      level: z.enum(['concern', 'acute']),
      language: z.enum(['de', 'fr', 'it']).default('de'),
      remove: z.string().optional(),
      id: z.uuid().optional().or(z.literal('')),
    })
    .parse(Object.fromEntries(form))
  if (d.id && d.remove) await db.update(crisisTerms).set({ active: false }).where(eq(crisisTerms.id, d.id))
  else
    await db
      .insert(crisisTerms)
      .values({ term: d.term.toLowerCase(), level: d.level, language: d.language })
      .onConflictDoUpdate({ target: [crisisTerms.language, crisisTerms.term], set: { level: d.level, active: true } })
  await audit(admin.userId, 'crisis-terms:update', admin.userId, d.term)
  updateTag('crisis-terms')
}

export async function saveStep(form: FormData): Promise<AdminResult> {
  const admin = await assertModerator('admin')
  const parsed = z
    .object({
      id: z.uuid().optional().or(z.literal('')),
      text: str(200),
      circleId: z.uuid().optional().or(z.literal('')),
      sort: z.coerce.number().int().min(0).max(999),
      isActive: z.string().optional(),
      textFr: optional(200),
      textIt: optional(200),
    })
    .safeParse(Object.fromEntries(form))
  if (!parsed.success) return nope(INVALID)
  const d = parsed.data
  const i18n = { ...(d.textFr ? { fr: { text: d.textFr } } : {}), ...(d.textIt ? { it: { text: d.textIt } } : {}) }
  const values = { text: d.text, circleId: d.circleId || null, sort: d.sort, isActive: d.isActive === 'on', i18n }
  if (values.circleId) {
    const [c] = await db.select({ id: circles.id }).from(circles).where(eq(circles.id, values.circleId))
    if (!c) return nope('Den gewählten Kreis gibt es nicht mehr.')
  }
  if (d.id) {
    const [row] = await db.update(steps).set(values).where(eq(steps.id, d.id)).returning({ id: steps.id })
    if (!row) return nope('Diesen Schritt gibt es nicht mehr.')
  } else await db.insert(steps).values(values)
  await audit(admin.userId, d.id ? 'steps:update' : 'steps:create', admin.userId, d.text.slice(0, 60))
  // Schritte liest die App direkt aus der Datenbank – sie gelten ab dem nächsten Laden.
  changed()
  return done(d.id ? 'Schritt gespeichert.' : 'Schritt hinzugefügt.')
}

export async function deleteStep(form: FormData): Promise<AdminResult> {
  const admin = await assertModerator('admin')
  const id = z.uuid().safeParse(form.get('id'))
  if (!id.success) return nope(INVALID)
  const [row] = await db.delete(steps).where(eq(steps.id, id.data)).returning({ text: steps.text })
  if (!row) return nope('Diesen Schritt gibt es nicht mehr.')
  await audit(admin.userId, 'steps:delete', admin.userId, row.text.slice(0, 60))
  changed()
  return done('Schritt gelöscht.')
}

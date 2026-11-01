import 'server-only'
import { and, count, desc, eq, gt, isNotNull, isNull } from 'drizzle-orm'
import { db } from '@/db'
import { breathLog, checkins, circlePrefs, circles as circlesTable, posts, replies, stepLog } from '@/db/schema'
import { openText } from '@/lib/at-rest'
import { localizeCircle } from '@/lib/localize'
import { nightStaffed } from '@/lib/moderation-hours'
import { currentLocale } from '@/messages'
import { getBookmarkedPosts, getFeed, getMyPosts, getPostById, type FeedView } from './posts'
import { getViewer } from './session'
import { getCircles, getCrisisTerms, getHelpResources } from './terms'

/**
 * Lesende Abfragen für die Apps. Im Web stecken sie in Server Components (Layout, «Ich»-Seite);
 * hier geben sie dieselben Daten als JSON zurück – ohne user_id oder Benutzernamen anderer (lib/dto.ts).
 */

/** Alles, was die App nach dem Start braucht – entspricht dem ViewerProvider im Layout. */
export async function me() {
  const v = await getViewer()
  if (!v) return null
  // Sprache aus «X-Locale» der App (lib/server/request-locale.ts) – Kreise und Hilfe-Nummern wie im Web übersetzt.
  const locale = currentLocale()
  const [last, circles, crisisTerms, help, follows] = await Promise.all([
    db.select({ mood: checkins.mood }).from(checkins).where(eq(checkins.userId, v.userId)).orderBy(desc(checkins.createdAt)).limit(1),
    getCircles(),
    getCrisisTerms(),
    getHelpResources(locale),
    db
      .select({ slug: circlesTable.slug, state: circlePrefs.state })
      .from(circlePrefs)
      .innerJoin(circlesTable, eq(circlesTable.id, circlePrefs.circleId))
      .where(eq(circlePrefs.userId, v.userId)),
  ])
  const s = v.settings
  return {
    displayName: v.displayName,
    glyphSeed: v.glyphSeed,
    defaultVisibility: v.defaultVisibility,
    role: v.role,
    muted: v.status === 'muted',
    createdAt: v.createdAt.toISOString(),
    lastMood: last[0]?.mood ?? null,
    settings: {
      theme: s.theme ?? 'system',
      fontSize: s.fontSize ?? 'normal',
      motion: s.motion ?? 'on',
      breathSound: s.breathSound ?? false,
      collapseWarnings: s.collapseWarnings ?? true,
      hidePresence: s.hidePresence ?? false,
      discreet: s.discreet ?? false,
      listener: s.listener ?? false,
      onboard: s.onboard ?? false,
      locale: s.locale ?? null,
    },
    circles: circles.map((c) => localizeCircle(c, locale)).map(({ slug, name, description, rules, color }) => ({ slug, name, description, rules, color })),
    circlePrefs: Object.fromEntries(follows.map((f) => [f.slug, f.state])),
    crisisTerms,
    help,
    nightModeration: nightStaffed(),
  }
}

/** Feed wie /start – `circle` ist ein Kreis-Slug, «meine» (gefolgte Kreise) oder leer. */
export async function feed(view: string, circle: string | null, cursor: string | null) {
  const v = await getViewer()
  if (!v) return null
  const safeView: FeedView = view === 'unheard' || view === 'brave' ? view : 'all'
  const followed = circle === 'meine'
  let circleId: string | null = null
  if (circle && !followed) {
    const [c] = await db.select({ id: circlesTable.id }).from(circlesTable).where(eq(circlesTable.slug, circle))
    circleId = c?.id ?? null
  }
  return getFeed({ viewerId: v.userId, view: safeView, circleId, followed, cursor })
}

export async function post(id: string) {
  const v = await getViewer()
  if (!v || typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return null
  return getPostById(v.userId, id)
}

export async function myPosts() {
  const v = await getViewer()
  return v ? getMyPosts(v.userId) : []
}

export async function bookmarks() {
  const v = await getViewer()
  return v ? getBookmarkedPosts(v.userId) : []
}

/** «Verlauf» unter «Ich»: Check-ins der letzten 30 Tage samt Notizen, Atemübungen und gemachte Schritte. */
export async function history() {
  const v = await getViewer()
  if (!v) return null
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const [rows, [breaths], [stepsDone]] = await Promise.all([
    db
      .select({ mood: checkins.mood, note: checkins.note, createdAt: checkins.createdAt })
      .from(checkins)
      .where(and(eq(checkins.userId, v.userId), gt(checkins.createdAt, since)))
      .orderBy(checkins.createdAt),
    db.select({ n: count() }).from(breathLog).where(eq(breathLog.userId, v.userId)),
    db.select({ n: count() }).from(stepLog).where(and(eq(stepLog.userId, v.userId), eq(stepLog.action, 'done'))),
  ])
  return {
    checkins: rows.map((r) => ({ mood: r.mood, note: r.note ? openText(v.userId, r.note) : null, createdAt: r.createdAt.toISOString() })),
    breaths: breaths?.n ?? 0,
    stepsDone: stepsDone?.n ?? 0,
  }
}

/** «Gutgetan»: Antworten auf eigene Gedanken, die als hilfreich markiert sind. */
export async function saved() {
  const v = await getViewer()
  if (!v) return []
  const rows = await db
    .select({ id: replies.id, body: replies.body, handle: replies.authorHandle, createdAt: replies.createdAt, postBody: posts.body })
    .from(replies)
    .innerJoin(posts, eq(posts.id, replies.postId))
    .where(and(eq(posts.userId, v.userId), eq(replies.helpful, true), isNull(replies.deletedAt), isNull(posts.deletedAt), isNotNull(replies.body)))
    .orderBy(desc(replies.createdAt))
  return rows.map((r) => ({ id: r.id, body: r.body, authorHandle: r.handle, createdAt: r.createdAt.toISOString(), postBody: r.postBody }))
}

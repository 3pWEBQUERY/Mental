import 'server-only'
import { and, asc, desc, eq, gt, inArray, isNull, lt, ne, notInArray, or, sql, type SQL } from 'drizzle-orm'
import { db } from '@/db'
import { blocks, bookmarks, circlePrefs, circles, postHides, postMedia, posts, replies, support, users } from '@/db/schema'
import { LIMITS, type SupportKind } from '../constants'
import { toPublicPost, type PostRow, type PublicMedia, type PublicPost, type ReplyRow, type SupportSummary } from '../dto'

export type FeedView = 'all' | 'unheard' | 'brave'

const postColumns = {
  id: posts.id,
  userId: posts.userId,
  authorHandle: posts.authorHandle,
  glyphSeed: posts.glyphSeed,
  mood: posts.mood,
  need: posts.need,
  body: posts.body,
  contentWarning: posts.contentWarning,
  createdAt: posts.createdAt,
  editedAt: posts.editedAt,
  replyCount: posts.replyCount,
  closed: posts.closed,
  visibility: posts.visibility,
  status: posts.status,
  crisisLevel: posts.crisisLevel,
  moderationNote: posts.moderationNote,
  circleSlug: circles.slug,
  circleName: circles.name,
  circleColor: circles.color,
}

/**
 * Blockierte Mitglieder sehen sich gegenseitig nie – unter ihrem Namen.
 * Anonyme Gedanken bleiben davon unberührt (sonst liessen sie sich über Block/Entblocken einer Person zuordnen);
 * die blendet man einzeln über `post_hides` aus.
 */
export function notBlocked(viewerId: string, column: typeof posts.userId | typeof replies.userId): SQL {
  return and(
    notInArray(column, db.select({ id: blocks.blockedId }).from(blocks).where(eq(blocks.blockerId, viewerId))),
    notInArray(column, db.select({ id: blocks.blockerId }).from(blocks).where(eq(blocks.blockedId, viewerId))),
  )!
}

/** Sichtbar für diese Person: freigegeben – oder der eigene Gedanke, egal in welchem Zustand. */
function visibleTo(viewerId: string): SQL {
  return and(
    isNull(posts.deletedAt),
    or(eq(posts.status, 'visible'), and(eq(posts.userId, viewerId), ne(posts.status, 'removed'))),
    ne(users.status, 'deleting'),
    or(eq(posts.visibility, 'anonymous'), notBlocked(viewerId, posts.userId)),
    notInArray(posts.id, db.select({ id: postHides.postId }).from(postHides).where(eq(postHides.userId, viewerId))),
  )!
}

function baseQuery() {
  return db
    .select(postColumns)
    .from(posts)
    .innerJoin(circles, eq(circles.id, posts.circleId))
    .innerJoin(users, eq(users.id, posts.userId))
    .$dynamic()
}

function mutedCircles(viewerId: string) {
  return db
    .select({ id: circlePrefs.circleId })
    .from(circlePrefs)
    .where(and(eq(circlePrefs.userId, viewerId), eq(circlePrefs.state, 'mute')))
}

/** Lädt Antworten, Zuspruch, Merkliste und Bild für eine Seite von Gedanken. */
export async function hydrate(rows: PostRow[], viewerId: string): Promise<PublicPost[]> {
  if (!rows.length) return []
  const ids = rows.map((r) => r.id)
  // Antworten der Verfasserin in einem anonymen Thread tragen deren anonyme Identität – kein Konto-Block.
  const anonIds = rows.filter((r) => r.visibility === 'anonymous').map((r) => r.id)
  const mineIds = rows.filter((r) => r.userId === viewerId).map((r) => r.id)
  const [replyRows, supportRows, bookmarkRows, mediaRows] = await Promise.all([
    db
      .select({
        id: replies.id,
        postId: replies.postId,
        userId: replies.userId,
        authorHandle: replies.authorHandle,
        glyphSeed: replies.glyphSeed,
        isAuthor: replies.isAuthor,
        body: replies.body,
        status: replies.status,
        helpful: replies.helpful,
        hiddenByAuthor: replies.hiddenByAuthor,
        createdAt: replies.createdAt,
        deletedAt: replies.deletedAt,
      })
      .from(replies)
      .leftJoin(users, eq(users.id, replies.userId))
      .where(
        and(
          inArray(replies.postId, ids),
          or(
            eq(replies.status, 'visible'),
            eq(replies.userId, viewerId),
            sql`${replies.deletedAt} IS NOT NULL`,
          ),
          or(ne(users.status, 'deleting'), sql`${replies.deletedAt} IS NOT NULL`),
          or(
            isNull(replies.userId),
            notBlocked(viewerId, replies.userId),
            ...(anonIds.length ? [and(eq(replies.isAuthor, true), inArray(replies.postId, anonIds))] : []),
          ),
        ),
      )
      .orderBy(asc(replies.createdAt)),
    // Nur was gebraucht wird: eigener Zuspruch – und für eigene Gedanken die private Zusammenfassung.
    db
      .select({ postId: support.postId, userId: support.userId, kind: support.kind })
      .from(support)
      .where(
        and(
          inArray(support.postId, ids),
          or(eq(support.userId, viewerId), ...(mineIds.length ? [inArray(support.postId, mineIds)] : []))!,
        ),
      ),
    db
      .select({ postId: bookmarks.postId })
      .from(bookmarks)
      .where(and(eq(bookmarks.userId, viewerId), inArray(bookmarks.postId, ids))),
    db
      .select({
        id: postMedia.id,
        postId: postMedia.postId,
        status: postMedia.status,
        width: postMedia.width,
        height: postMedia.height,
        blurhash: postMedia.blurhash,
      })
      .from(postMedia)
      .where(inArray(postMedia.postId, ids)),
  ])

  const marked = new Set(bookmarkRows.map((b) => b.postId))
  return rows.map((p) => {
    const mine = p.userId === viewerId
    const sup = supportRows.filter((s) => s.postId === p.id)
    let summary: SupportSummary | null = null
    if (mine) {
      const people = new Set(sup.map((s) => s.userId))
      summary = {
        total: people.size,
        hear: sup.filter((s) => s.kind === 'hear').length,
        same: sup.filter((s) => s.kind === 'same').length,
        strong: sup.filter((s) => s.kind === 'strong').length,
      }
    }
    const media = mediaRows.find((mr) => mr.postId === p.id)
    const publicMedia: PublicMedia | null =
      media && (media.status === 'ready' || mine)
        ? { id: media.id, status: media.status, width: media.width, height: media.height, blurhash: media.blurhash }
        : null
    return toPublicPost(p, {
      viewerId,
      replies: replyRows.filter((r) => r.postId === p.id) as ReplyRow[],
      mySupport: sup.filter((s) => s.userId === viewerId).map((s) => s.kind as SupportKind),
      supportSummary: summary,
      bookmarked: marked.has(p.id),
      media: publicMedia,
    })
  })
}

/* ----------------------------------------------------------------- Feed */

/** t/i: letzter Gedanke (Zeit, ID); k: war er «Sorge» (nur «Braucht Zuspruch»); u: eingestreute IDs; n: bisher gezeigt. */
type Cursor = { t?: string; i?: string; k?: boolean; u?: string[]; n: number }

const encode = (c: Cursor) => Buffer.from(JSON.stringify(c)).toString('base64url')
function decode(raw: string | null | undefined): Cursor {
  if (!raw) return { n: 0 }
  try {
    const c = JSON.parse(Buffer.from(raw, 'base64url').toString()) as Cursor
    return { ...c, n: Number(c.n) || 0, u: Array.isArray(c.u) ? c.u.slice(-20) : [] }
  } catch {
    return { n: 0 }
  }
}

export type FeedPage = { posts: PublicPost[]; nextCursor: string | null; caughtUp: boolean }

/** «Braucht Zuspruch»: ohne Antwort, max. 72 h alt, Sorge zuerst, sonst älteste zuerst. */
function unheardWhere(viewerId: string): SQL {
  return and(
    eq(posts.status, 'visible'),
    eq(posts.replyCount, 0),
    eq(posts.closed, false),
    ne(posts.userId, viewerId),
    gt(posts.createdAt, new Date(Date.now() - LIMITS.unheardMaxAgeMs)),
  )!
}
const unheardOrder = [sql`(${posts.crisisLevel} = 'concern') DESC`, asc(posts.createdAt), asc(posts.id)]

export async function getFeed(opts: {
  viewerId: string
  view: FeedView
  circleId?: string | null
  cursor?: string | null
}): Promise<FeedPage> {
  const { viewerId, view, circleId } = opts
  const c = decode(opts.cursor)
  const size = LIMITS.feedPageSize
  const remaining = LIMITS.feedDailyCap - c.n
  if (remaining <= 0) return { posts: [], nextCursor: null, caughtUp: true }
  const take = Math.min(size, remaining)

  const scope: SQL[] = [visibleTo(viewerId)]
  if (circleId) scope.push(eq(posts.circleId, circleId))
  else scope.push(notInArray(posts.circleId, mutedCircles(viewerId)))

  if (view === 'unheard') {
    // Keyset statt OFFSET: Bekommt ein Gedanke auf Seite 1 eine Antwort, fällt er heraus –
    // mit OFFSET rutschte dann einer unbemerkt über die Seitengrenze und würde nie gezeigt.
    const after: SQL[] = []
    if (c.t && c.i) {
      const t = new Date(c.t)
      // Der Cursor kennt nur Millisekunden, Postgres speichert Mikrosekunden – darum auf ms gekürzt vergleichen.
      const ms = sql`date_trunc('milliseconds', ${posts.createdAt})`
      const later = or(sql`${ms} > ${t}`, and(sql`${ms} = ${t}`, gt(posts.id, c.i)))!
      const concern = sql`${posts.crisisLevel} = 'concern'`
      after.push(c.k ? or(and(concern, later)!, sql`NOT (${concern})`)! : and(sql`NOT (${concern})`, later)!)
    }
    const rows = await baseQuery()
      .where(and(...scope, unheardWhere(viewerId), ...after))
      .orderBy(...unheardOrder)
      .limit(take + 1)
    const page = rows.slice(0, take)
    const n = c.n + page.length
    const more = rows.length > take && n < LIMITS.feedDailyCap
    const last = page.at(-1)
    return {
      posts: await hydrate(page, viewerId),
      nextCursor: more && last ? encode({ t: last.createdAt.toISOString(), i: last.id, k: last.crisisLevel === 'concern', n }) : null,
      caughtUp: n >= LIMITS.feedDailyCap,
    }
  }

  const where = [...scope]
  if (view === 'brave') where.push(eq(posts.need, 'brave'))
  if (c.t && c.i) {
    const t = new Date(c.t)
    where.push(or(lt(posts.createdAt, t), and(eq(posts.createdAt, t), lt(posts.id, c.i)))!)
  }
  const injectedBefore = c.u ?? []
  if (injectedBefore.length) where.push(notInArray(posts.id, injectedBefore))

  const main = await baseQuery()
    .where(and(...where))
    .orderBy(desc(posts.createdAt), desc(posts.id))
    .limit(take + 1)

  // In «Alle» wird jeder fünfte Platz mit einem Gedanken aus «Braucht Zuspruch» belegt.
  let pool: PostRow[] = []
  if (view === 'all') {
    const exclude = [...injectedBefore, ...main.map((r) => r.id)]
    pool = await baseQuery()
      .where(and(...scope, unheardWhere(viewerId), exclude.length ? notInArray(posts.id, exclude) : undefined))
      .orderBy(...unheardOrder)
      .limit(Math.floor(take / 5))
  }

  const page: PostRow[] = []
  const injected: string[] = []
  let mi = 0
  while (page.length < take) {
    const slotForUnheard = (page.length + 1) % 5 === 0 && pool.length > 0
    if (slotForUnheard) {
      const u = pool.shift()!
      page.push(u)
      injected.push(u.id)
      continue
    }
    const next = main[mi]
    if (!next) break
    page.push(next)
    mi++
  }
  const lastMain = main[mi - 1]
  const n = c.n + page.length
  const more = main.length > mi && n < LIMITS.feedDailyCap
  return {
    posts: await hydrate(page, viewerId),
    nextCursor:
      more && lastMain
        ? encode({ t: lastMain.createdAt.toISOString(), i: lastMain.id, u: [...injectedBefore, ...injected], n })
        : null,
    caughtUp: n >= LIMITS.feedDailyCap,
  }
}

export async function getPostById(viewerId: string, postId: string): Promise<PublicPost | null> {
  const rows = await baseQuery()
    .where(and(eq(posts.id, postId), visibleTo(viewerId)))
    .limit(1)
  const [p] = await hydrate(rows, viewerId)
  return p ?? null
}

export async function getMyPosts(viewerId: string, limit = 50) {
  const rows = await baseQuery()
    .where(and(eq(posts.userId, viewerId), isNull(posts.deletedAt), ne(posts.status, 'removed')))
    .orderBy(desc(posts.createdAt))
    .limit(limit)
  return hydrate(rows, viewerId)
}

export async function getBookmarkedPosts(viewerId: string) {
  const rows = await baseQuery()
    .innerJoin(bookmarks, and(eq(bookmarks.postId, posts.id), eq(bookmarks.userId, viewerId)))
    .where(visibleTo(viewerId))
    .orderBy(desc(bookmarks.createdAt))
    .limit(100)
  return hydrate(rows, viewerId)
}

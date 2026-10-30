import { LIMITS, type Need, type SupportKind } from './constants'

/**
 * Öffentliche Datenformen. Sie enthalten NIE user_id oder username –
 * nur die pro Beitrag gewählte author_handle. Ein Unit-Test prüft das (tests/unit/dto.test.ts).
 */
export type PublicCircle = { slug: string; name: string; color: string }

export type PublicMedia = {
  id: string
  status: 'quarantine' | 'review' | 'ready' | 'rejected'
  width: number | null
  height: number | null
  blurhash: string | null
}

export type PublicReply = {
  id: string
  authorHandle: string
  glyphSeed: number
  isAuthor: boolean
  body: string | null
  deleted: boolean
  isMine: boolean
  pending: boolean
  /** nur für die antwortende Person bzw. die Verfasserin des Gedankens gesetzt */
  helpful: boolean
  hiddenByAuthor: boolean
  createdAt: string
}

export type SupportSummary = { total: number; hear: number; same: number; strong: number }

export type PublicPost = {
  id: string
  authorHandle: string
  /** Ohnehin sichtbar («Anonym»); steuert, ob «Blockieren» nur diesen Gedanken ausblendet. */
  anonymous: boolean
  glyphSeed: number
  mood: number
  circle: PublicCircle
  need: Need
  body: string
  contentWarning: boolean
  createdAt: string
  editedAt: string | null
  /** Nur für die Verfasserin: wann der Gedanke sich selbst löscht. */
  expiresAt: string | null
  replyCount: number
  closed: boolean
  isMine: boolean
  canEdit: boolean
  /** nur bei eigenen Gedanken */
  status: 'pending' | 'visible' | 'hidden' | 'removed' | null
  crisisLevel: 'none' | 'concern' | 'acute' | null
  moderationNote: string | null
  supportSummary: SupportSummary | null
  mySupport: SupportKind[]
  bookmarked: boolean
  media: PublicMedia | null
  replies: PublicReply[]
}

export type PostRow = {
  id: string
  userId: string
  authorHandle: string
  glyphSeed: number
  mood: number
  need: Need
  body: string
  contentWarning: boolean
  createdAt: Date
  editedAt: Date | null
  expiresAt: Date | null
  replyCount: number
  closed: boolean
  visibility: 'anonymous' | 'pseudonym'
  status: 'pending' | 'visible' | 'hidden' | 'removed'
  crisisLevel: 'none' | 'concern' | 'acute'
  moderationNote: string | null
  circleSlug: string
  circleName: string
  circleColor: string
}

export type ReplyRow = {
  id: string
  postId: string
  userId: string | null
  authorHandle: string
  glyphSeed: number
  isAuthor: boolean
  body: string
  status: 'pending' | 'visible' | 'hidden' | 'removed'
  helpful: boolean
  hiddenByAuthor: boolean
  createdAt: Date
  deletedAt: Date | null
}

export function toPublicReply(r: ReplyRow, viewerId: string, postOwnerId: string): PublicReply {
  const isMine = r.userId === viewerId
  const viewerIsOwner = postOwnerId === viewerId
  const deleted = r.deletedAt !== null || r.status === 'removed'
  return {
    id: r.id,
    authorHandle: r.authorHandle,
    glyphSeed: r.glyphSeed,
    isAuthor: r.isAuthor,
    body: deleted ? null : r.body,
    deleted,
    isMine,
    pending: isMine && r.status === 'pending',
    helpful: isMine || viewerIsOwner ? r.helpful : false,
    hiddenByAuthor: r.hiddenByAuthor,
    createdAt: r.createdAt.toISOString(),
  }
}

export function toPublicPost(
  p: PostRow,
  ctx: {
    viewerId: string
    replies: ReplyRow[]
    mySupport: SupportKind[]
    supportSummary: SupportSummary | null
    bookmarked: boolean
    media: PublicMedia | null
    now?: number
  },
): PublicPost {
  const isMine = p.userId === ctx.viewerId
  const now = ctx.now ?? Date.now()
  return {
    id: p.id,
    authorHandle: p.authorHandle,
    anonymous: p.visibility === 'anonymous',
    glyphSeed: p.glyphSeed,
    mood: p.mood,
    circle: { slug: p.circleSlug, name: p.circleName, color: p.circleColor },
    need: p.need,
    body: p.body,
    contentWarning: p.contentWarning,
    createdAt: p.createdAt.toISOString(),
    editedAt: p.editedAt?.toISOString() ?? null,
    expiresAt: isMine ? (p.expiresAt?.toISOString() ?? null) : null,
    replyCount: p.replyCount,
    closed: p.closed,
    isMine,
    canEdit: isMine && now - p.createdAt.getTime() < LIMITS.editWindowMs,
    status: isMine ? p.status : null,
    crisisLevel: isMine ? p.crisisLevel : null,
    moderationNote: isMine ? p.moderationNote : null,
    supportSummary: isMine ? ctx.supportSummary : null,
    mySupport: isMine ? [] : ctx.mySupport,
    bookmarked: ctx.bookmarked,
    media: ctx.media,
    replies: ctx.replies
      .filter((r) => !r.hiddenByAuthor || r.userId === ctx.viewerId || isMine)
      .map((r) => toPublicReply(r, ctx.viewerId, p.userId)),
  }
}

import { describe, expect, it } from 'vitest'
import { toPublicPost, type PostRow, type ReplyRow } from '@/lib/dto'

const AUTHOR = '0190f0c0-0000-7000-8000-000000000001'
const OTHER = '0190f0c0-0000-7000-8000-000000000002'
const VIEWER = '0190f0c0-0000-7000-8000-000000000003'

const post: PostRow = {
  id: '0190f0c0-0000-7000-8000-0000000000aa',
  userId: AUTHOR,
  authorHandle: 'Anonym',
  glyphSeed: 42,
  mood: 1,
  need: 'listen',
  body: 'Sonntage sind am schwersten.',
  contentWarning: false,
  createdAt: new Date(),
  editedAt: null,
  replyCount: 1,
  closed: false,
  visibility: 'anonymous',
  status: 'visible',
  crisisLevel: 'concern',
  moderationNote: null,
  circleSlug: 'einsamkeit',
  circleName: 'Einsamkeit',
  circleColor: '#B89A62',
}
const reply: ReplyRow = {
  id: '0190f0c0-0000-7000-8000-0000000000bb',
  postId: post.id,
  userId: OTHER,
  authorHandle: 'Jonas',
  glyphSeed: 7,
  isAuthor: false,
  body: 'Du bist damit nicht allein.',
  status: 'visible',
  helpful: true,
  hiddenByAuthor: false,
  createdAt: new Date(),
  deletedAt: null,
}

/** Sucht rekursiv nach verbotenen Schlüsseln und Werten. */
function leaks(value: unknown, path = '$'): string[] {
  if (value === null || typeof value !== 'object') {
    return typeof value === 'string' && [AUTHOR, OTHER, VIEWER].includes(value) ? [path] : []
  }
  return Object.entries(value).flatMap(([k, v]) => {
    const here = `${path}.${k}`
    const bad = /^(user_?id|userId|username|reporter_?id|password|recovery)/i.test(k) ? [here] : []
    return [...bad, ...leaks(v, here)]
  })
}

const ctx = { replies: [reply], mySupport: [], supportSummary: { total: 3, hear: 2, same: 1, strong: 0 }, bookmarked: false, media: null }

describe('toPublicPost – Schutz vor De-Anonymisierung', () => {
  it('enthält nie user_id, username oder eine Konto-ID – weder beim Gedanken noch bei Antworten', () => {
    for (const viewerId of [VIEWER, AUTHOR, OTHER]) {
      expect(leaks(toPublicPost(post, { ...ctx, viewerId }))).toEqual([])
    }
  })

  it('zeigt Zuspruch-Zahlen und Krisenstufe nur der Verfasserin', () => {
    const forOthers = toPublicPost(post, { ...ctx, viewerId: VIEWER })
    expect(forOthers.supportSummary).toBeNull()
    expect(forOthers.crisisLevel).toBeNull()
    expect(forOthers.status).toBeNull()
    const forAuthor = toPublicPost(post, { ...ctx, viewerId: AUTHOR })
    expect(forAuthor.supportSummary?.total).toBe(3)
    expect(forAuthor.crisisLevel).toBe('concern')
    expect(forAuthor.isMine).toBe(true)
  })

  it('«Das hat mir gutgetan» sehen nur die antwortende Person und die Verfasserin', () => {
    expect(toPublicPost(post, { ...ctx, viewerId: VIEWER }).replies[0]!.helpful).toBe(false)
    expect(toPublicPost(post, { ...ctx, viewerId: OTHER }).replies[0]!.helpful).toBe(true)
    expect(toPublicPost(post, { ...ctx, viewerId: AUTHOR }).replies[0]!.helpful).toBe(true)
  })

  it('von der Verfasserin ausgeblendete Antworten sehen andere nicht', () => {
    const hidden = { ...ctx, replies: [{ ...reply, hiddenByAuthor: true }] }
    expect(toPublicPost(post, { ...hidden, viewerId: VIEWER }).replies).toHaveLength(0)
    expect(toPublicPost(post, { ...hidden, viewerId: AUTHOR }).replies).toHaveLength(1)
    expect(toPublicPost(post, { ...hidden, viewerId: OTHER }).replies).toHaveLength(1)
  })

  it('gelöschte Antworten erscheinen ohne Text als Platzhalter', () => {
    const gone = toPublicPost(post, { ...ctx, viewerId: VIEWER, replies: [{ ...reply, userId: null, body: '', deletedAt: new Date() }] })
    expect(gone.replies[0]).toMatchObject({ deleted: true, body: null })
  })

  it('erlaubt Bearbeiten nur in den ersten 15 Minuten', () => {
    const old = { ...post, createdAt: new Date(Date.now() - 16 * 60 * 1000) }
    expect(toPublicPost(post, { ...ctx, viewerId: AUTHOR }).canEdit).toBe(true)
    expect(toPublicPost(old, { ...ctx, viewerId: AUTHOR }).canEdit).toBe(false)
    expect(toPublicPost(post, { ...ctx, viewerId: VIEWER }).canEdit).toBe(false)
  })
})

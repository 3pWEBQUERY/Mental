import { and, asc, eq, inArray, isNull } from 'drizzle-orm'
import { db } from '@/db'
import { circles, postMedia, posts } from '@/db/schema'
import { requireModerator } from '@/lib/server/admin'
import { memberRef } from '@/lib/server/crypto'
import { relativeTime } from '@/lib/time'
import { m } from '@/messages'
import { cleanImage, reviewImage } from '../actions'

/** Bildfreigabe: jedes Bild an einem Gedanken wartet hier, bis die Moderation es freigibt oder ablehnt. */
export default async function ImagesPage() {
  await requireModerator('mod')
  const rows = await db
    .select({
      id: postMedia.id,
      status: postMedia.status,
      type: postMedia.contentType,
      width: postMedia.width,
      height: postMedia.height,
      createdAt: postMedia.createdAt,
      userId: postMedia.userId,
      body: posts.body,
      postStatus: posts.status,
      circle: circles.name,
    })
    .from(postMedia)
    .innerJoin(posts, eq(posts.id, postMedia.postId))
    .innerJoin(circles, eq(circles.id, posts.circleId))
    .where(and(inArray(postMedia.status, ['quarantine', 'review']), isNull(posts.deletedAt)))
    .orderBy(asc(postMedia.createdAt))
    .limit(100)
  const t = m.admin.images

  return (
    <div className="stack">
      <h1 className="page-title">{t.title}</h1>
      <p className="fine" style={{ maxWidth: 640 }}>
        {t.intro}
      </p>
      {rows.length ? <p className="count">{t.waiting(rows.length)}</p> : <p className="notice">{t.empty}</p>}
      <ul>
        {rows.map((r) => (
          <li key={r.id} className="queue-item image-review">
            <div className="top">
              <span className={`prio ${r.status === 'quarantine' ? 'p1' : ''}`}>{t.status[r.status as 'quarantine' | 'review']}</span>
              <span>{r.circle}</span>
              <span>
                {m.admin.member} {memberRef(r.userId)}
              </span>
              <span>{relativeTime(r.createdAt)}</span>
            </div>
            <div className="image-review-body">
              {r.status === 'review' ? (
                <a href={`/api/admin/media/${r.id}`} target="_blank" rel="noreferrer" className="image-review-preview">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/admin/media/${r.id}`} alt="" width={r.width ?? undefined} height={r.height ?? undefined} />
                </a>
              ) : (
                <div className="image-review-preview stack" style={{ gap: 12, padding: 20, textAlign: 'center', justifyItems: 'center' }}>
                  <p className="fine">{t.quarantineHint}</p>
                  <form action={cleanImage}>
                    <input type="hidden" name="mediaId" value={r.id} />
                    <button className="btn small">{t.clean}</button>
                  </form>
                </div>
              )}
              <div className="stack" style={{ gap: 10 }}>
                <blockquote>{r.body || '—'}</blockquote>
                {r.postStatus !== 'visible' && <p className="fine">{t.postHidden}</p>}
              </div>
            </div>
            <form action={reviewImage} className="inline-form">
              <input type="hidden" name="mediaId" value={r.id} />
              <input className="input" name="reason" placeholder={t.reason} maxLength={500} aria-label={t.reason} />
              {r.status === 'review' && (
                <button className="btn small" name="decision" value="approve">
                  {t.approve}
                </button>
              )}
              <button className="btn ghost small danger" name="decision" value="reject">
                {t.reject}
              </button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  )
}

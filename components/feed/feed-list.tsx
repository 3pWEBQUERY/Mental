'use client'

import { useEffect, useState, useTransition } from 'react'
import { loadFeed } from '@/app/(app)/actions'
import { emit, on } from '@/lib/client/bus'
import type { PublicPost } from '@/lib/dto'
import type { FeedView } from '@/lib/server/posts'
import { m } from '@/messages'
import { PostCard } from './post-card'
import { PostDialog } from './post-dialog'
import { ReportDialog, type ReportTarget } from './report-dialog'

/**
 * Kein endloses Scrollen: 20 Gedanken pro Seite, nach 60 ist für heute Schluss –
 * mit einem Vorschlag zum Atmen statt weiterem Scrollen.
 */
export function FeedList({
  initial,
  nextCursor: initialCursor,
  caughtUp: initialCaughtUp,
  view,
  circle,
}: {
  initial: PublicPost[]
  nextCursor: string | null
  caughtUp: boolean
  view: FeedView
  circle: string | null
}) {
  const [posts, setPosts] = useState(initial)
  const [cursor, setCursor] = useState(initialCursor)
  const [caughtUp, setCaughtUp] = useState(initialCaughtUp)
  const [report, setReport] = useState<ReportTarget>(null)
  const [pending, start] = useTransition()
  const [openId, setOpenId] = useState<string | null>(null)

  // Kein Zurücksetzen bei Server-Refresh: Eine Karte, auf die gerade geantwortet wird, bleibt stehen –
  // auch wenn sie danach nicht mehr zu «Braucht Zuspruch» gehört. Ansicht- und Kreiswechsel setzen per key neu.
  useEffect(
    () =>
      on('post-created', (p) => {
        if (view === 'all' || (view === 'brave' && p.need === 'brave')) {
          if (!circle || circle === p.circle.slug) setPosts((cur) => [p, ...cur])
        }
      }),
    [view, circle],
  )
  useEffect(() => on('post-updated', (p) => setPosts((cur) => cur.map((x) => (x.id === p.id ? p : x)))), [])

  function more() {
    start(async () => {
      const page = await loadFeed(view, circle, cursor)
      if (!page) return
      setPosts((cur) => [...cur, ...page.posts.filter((p) => !cur.some((c) => c.id === p.id))])
      setCursor(page.nextCursor)
      setCaughtUp(page.caughtUp)
    })
  }

  const f = m.feed
  return (
    <>
      <div className="list">
        {posts.length === 0 ? (
          <div className="empty">
            <b>{view === 'unheard' ? f.emptyUnheard : f.empty}</b>
            {f.emptyHint}
            <div>
              <button type="button" className="btn" onClick={() => emit('compose')}>
                {m.composer.title}
              </button>
            </div>
          </div>
        ) : (
          posts.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              onChange={(np) => setPosts((cur) => cur.map((x) => (x.id === np.id ? np : x)))}
              onRemove={(id) => setPosts((cur) => cur.filter((x) => x.id !== id))}
              onReport={setReport}
              onOpen={() => setOpenId(p.id)}
            />
          ))
        )}
      </div>
      {caughtUp ? (
        <div className="empty">
          <b>{f.caughtUp}</b>
          {f.caughtUpHint}
          <div>
            <button type="button" className="btn" onClick={() => emit('breathe')}>
              {f.caughtUpBreathe}
            </button>
          </div>
        </div>
      ) : (
        cursor && (
          <div className="more">
            <button type="button" className="btn ghost" onClick={more} disabled={pending}>
              {pending ? m.common.loading : f.loadMore}
            </button>
          </div>
        )
      )}
      <PostDialog
        post={posts.find((p) => p.id === openId) ?? null}
        onClose={() => setOpenId(null)}
        onChange={(np) => setPosts((cur) => cur.map((x) => (x.id === np.id ? np : x)))}
        onRemove={(id) => setPosts((cur) => cur.filter((x) => x.id !== id))}
        onReport={setReport}
      />
      <ReportDialog target={report} onClose={() => setReport(null)} />
    </>
  )
}

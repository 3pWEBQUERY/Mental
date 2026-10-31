'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { nextWaiting } from '@/app/(app)/actions'
import { attempt } from '@/lib/client/attempt'
import type { PublicPost } from '@/lib/dto'
import { m } from '@/messages'
import { PostCard } from './post-card'
import { ReportDialog, type ReportTarget } from './report-dialog'

/** Ein Gedanke, Antwortfeld offen, «Nächster Gedanke» – kein Scrollen, kein Zählen. */
export function WaitingOne({ initial, cursor: initialCursor }: { initial: PublicPost | null; cursor: string | null }) {
  const [post, setPost] = useState(initial)
  const [cursor, setCursor] = useState(initialCursor)
  const [report, setReport] = useState<ReportTarget>(null)
  const [pending, start] = useTransition()
  const w = m.waiting

  function next() {
    start(async () => {
      const res = await attempt(() => nextWaiting(cursor))
      if (!res) return
      setPost(res.post)
      setCursor(res.cursor)
      window.scrollTo({ top: 0 })
    })
  }

  return (
    <>
      <div className="feed-head">
        <h1>{w.title}</h1>
        <Link className="btn ghost small" href="/start?ansicht=unheard">
          {w.back}
        </Link>
      </div>
      <p className="manifest">{w.intro}</p>
      {post ? (
        <>
          <div className="list waiting-one">
            <PostCard key={post.id} post={post} onChange={setPost} onRemove={() => next()} onReport={setReport} defaultOpen />
          </div>
          <div className="more">
            <button type="button" className="btn" onClick={next} disabled={pending || !cursor}>
              {pending ? m.common.loading : cursor ? w.next : w.last}
            </button>
          </div>
        </>
      ) : (
        <div className="empty">
          <b>{m.feed.emptyUnheard}</b>
          {w.empty}
        </div>
      )}
      <ReportDialog target={report} onClose={() => setReport(null)} />
    </>
  )
}

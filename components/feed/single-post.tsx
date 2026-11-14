'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { PublicPost } from '@/lib/dto'
import { m } from '@/messages'
import { PostCard } from './post-card'
import { ReportDialog, type ReportTarget } from './report-dialog'

export function SinglePost({ post: initial }: { post: PublicPost | null }) {
  const router = useRouter()
  const [post, setPost] = useState(initial)
  const [report, setReport] = useState<ReportTarget>(null)
  return (
    <>
      {/* Seitentitel für Screenreader und die Überschriften-Navigation. */}
      <h1 className="sr-only">{m.feed.single}</h1>
      {/* Gleicher Kopf wie ein in der Spalte geöffneter Gedanke (feed-column.tsx). */}
      <div className="post-view-bar">
        <Link className="post-view-back" href="/start">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
          {m.feed.title}
        </Link>
        <span className="post-view-title" aria-hidden="true">
          {m.feed.postDialog}
        </span>
      </div>
      {post ? (
        <PostCard post={post} onChange={setPost} onRemove={() => router.replace('/start')} onReport={setReport} defaultOpen />
      ) : (
        <div className="empty">
          <b>{m.feed.deletedPost}</b>
        </div>
      )}
      <ReportDialog target={report} onClose={() => setReport(null)} />
    </>
  )
}

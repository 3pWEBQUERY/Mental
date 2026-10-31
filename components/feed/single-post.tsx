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
      <p style={{ marginBottom: 12 }}>
        <Link className="linkish" href="/start">
          ← {m.feed.title}
        </Link>
      </p>
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

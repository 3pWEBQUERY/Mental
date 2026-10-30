'use client'

import type { PublicPost } from '@/lib/dto'
import { m } from '@/messages'
import { Dialog } from '../dialog'
import { PostCard } from './post-card'
import type { ReportTarget } from './report-dialog'

/** Ein Gedanke gross – gleiche Fläche wie «Teile einen Gedanken», Antworten gleich offen. */
export function PostDialog({
  post,
  onClose,
  onChange,
  onRemove,
  onReport,
}: {
  post: PublicPost | null
  onClose: () => void
  onChange: (p: PublicPost) => void
  onRemove: (id: string) => void
  onReport: (t: ReportTarget) => void
}) {
  return (
    <Dialog open={Boolean(post)} onClose={onClose} title={m.feed.postDialog} className="dlg-large post-dlg">
      {post && (
        <PostCard
          key={post.id}
          post={post}
          onChange={onChange}
          onRemove={(id) => {
            onClose()
            onRemove(id)
          }}
          onReport={onReport}
          defaultOpen
        />
      )}
    </Dialog>
  )
}

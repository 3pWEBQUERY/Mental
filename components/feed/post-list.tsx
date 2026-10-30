'use client'

import { useState } from 'react'
import type { PublicPost } from '@/lib/dto'
import { PostCard } from './post-card'
import { PostDialog } from './post-dialog'
import { ReportDialog, type ReportTarget } from './report-dialog'

/** Einfache Liste ohne Paginierung – für «Ich». */
export function PostList({ initial, empty }: { initial: PublicPost[]; empty: string }) {
  const [posts, setPosts] = useState(initial)
  const [report, setReport] = useState<ReportTarget>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  if (!posts.length) return <p className="notice">{empty}</p>
  return (
    <>
      <div className="list" style={{ marginTop: 0 }}>
        {posts.map((p) => (
          <PostCard
            key={p.id}
            post={p}
            onChange={(np) => setPosts((cur) => cur.map((x) => (x.id === np.id ? np : x)))}
            onRemove={(id) => setPosts((cur) => cur.filter((x) => x.id !== id))}
            onReport={setReport}
            onOpen={() => setOpenId(p.id)}
          />
        ))}
      </div>
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

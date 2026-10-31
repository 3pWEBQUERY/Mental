import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Loading } from '@/components/ui'
import { SinglePost } from '@/components/feed/single-post'
import { isUuid } from '@/lib/id'
import { getPostById } from '@/lib/server/posts'
import { requireViewer } from '@/lib/server/session'
import { m } from '@/messages'

// Neutraler Titel – nie der Inhalt des Gedankens im Browser-Tab oder Verlauf.
export const metadata: Metadata = { title: m.feed.single }

export default function PostPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="feed" id="inhalt">
      <Suspense fallback={<Loading />}>
        <Post params={params} />
      </Suspense>
    </main>
  )
}

async function Post({ params }: { params: Promise<{ id: string }> }) {
  const v = await requireViewer()
  const { id } = await params
  const post = isUuid(id) ? await getPostById(v.userId, id) : null
  return <SinglePost post={post} />
}

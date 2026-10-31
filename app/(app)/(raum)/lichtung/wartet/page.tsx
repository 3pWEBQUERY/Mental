import type { Metadata } from 'next'
import { Suspense } from 'react'
import { WaitingOne } from '@/components/feed/waiting-one'
import { Loading } from '@/components/ui'
import { getFeed } from '@/lib/server/posts'
import { requireViewer } from '@/lib/server/session'
import { m } from '@/messages'

// Pro Anfrage, damit der Titel in der gewählten Sprache erscheint.
export async function generateMetadata(): Promise<Metadata> {
  return { title: m.waiting.title }
}

/** «Ein Gedanke wartet»: für Menschen, die Zuspruch schenken möchten – immer genau ein Gedanke. */
export default function WaitingPage() {
  return (
    <main className="feed" id="inhalt">
      <Suspense fallback={<Loading />}>
        <First />
      </Suspense>
    </main>
  )
}

async function First() {
  const v = await requireViewer()
  const page = await getFeed({ viewerId: v.userId, view: 'unheard', size: 1 })
  return <WaitingOne initial={page.posts[0] ?? null} cursor={page.nextCursor} />
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { eq } from 'drizzle-orm'
import { Suspense } from 'react'
import { Side } from '@/components/app/side'
import { PromptButton } from '@/components/feed/prompt'
import { FeedList } from '@/components/feed/feed-list'
import { db } from '@/db'
import { circles } from '@/db/schema'
import { getFeed, type FeedView } from '@/lib/server/posts'
import { requireViewer } from '@/lib/server/session'
import { m } from '@/messages'
import { currentStep, presenceCounts, touchCircle } from '../../actions'

export const metadata: Metadata = { title: m.feed.title }

type Search = Promise<{ ansicht?: string; kreis?: string }>

const VIEWS: { key: FeedView; label: string }[] = [
  { key: 'all', label: m.feed.tabs.all },
  { key: 'unheard', label: m.feed.tabs.unheard },
  { key: 'brave', label: m.feed.tabs.brave },
]

export default function FeedPage({ searchParams }: { searchParams: Search }) {
  return (
    <>
      <main className="feed" id="inhalt">
        <Suspense fallback={<FeedHead view="all" circle={null} />}>
          <Feed searchParams={searchParams} />
        </Suspense>
      </main>
      <Suspense fallback={<aside className="side" />}>
        <SideData />
      </Suspense>
    </>
  )
}

function FeedHead({ view, circle }: { view: FeedView; circle: string | null }) {
  const q = (v: FeedView) => {
    const p = new URLSearchParams()
    if (v !== 'all') p.set('ansicht', v)
    if (circle) p.set('kreis', circle)
    return p.size ? `/lichtung?${p}` : '/lichtung'
  }
  return (
    <>
      <div className="feed-head">
        <h2>{m.feed.title}</h2>
        <nav className="tabs" aria-label={m.feed.tabsLabel}>
          {VIEWS.map((t) => (
            <Link key={t.key} className="tab" href={q(t.key)} aria-current={view === t.key ? 'page' : undefined} scroll={false}>
              {t.label}
            </Link>
          ))}
        </nav>
      </div>
      <p className="manifest">{m.feed.manifest}</p>
      <PromptButton circle={circle} />
    </>
  )
}

async function Feed({ searchParams }: { searchParams: Search }) {
  const v = await requireViewer()
  const sp = await searchParams
  const view: FeedView = sp.ansicht === 'unheard' || sp.ansicht === 'brave' ? sp.ansicht : 'all'
  const [circle] = sp.kreis ? await db.select().from(circles).where(eq(circles.slug, sp.kreis)) : []
  if (circle) await touchCircle(circle.slug)
  const page = await getFeed({ viewerId: v.userId, view, circleId: circle?.id ?? null })
  const params = new URLSearchParams()
  if (view !== 'all') params.set('ansicht', view)
  return (
    <>
      <FeedHead view={view} circle={circle?.slug ?? null} />
      {circle && (
        <div className="filter">
          <span>{m.feed.circle}</span>
          <Link href={params.size ? `/lichtung?${params}` : '/lichtung'} scroll={false} aria-label={`${circle.name} – Filter entfernen`}>
            {m.feed.clearCircle(circle.name)}
          </Link>
          <p className="circle-desc">
            {circle.description} <span className="fine">{m.circles.rules}: {circle.rules}</span>
          </p>
        </div>
      )}
      <FeedList key={`${view}:${circle?.slug ?? ''}`} initial={page.posts} nextCursor={page.nextCursor} caughtUp={page.caughtUp} view={view} circle={circle?.slug ?? null} />
    </>
  )
}

async function SideData() {
  await requireViewer()
  const [presence, step] = await Promise.all([presenceCounts(), currentStep()])
  return <Side presence={presence} step={step} />
}

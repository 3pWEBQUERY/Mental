import type { Metadata } from 'next'
import Link from 'next/link'
import { eq } from 'drizzle-orm'
import { Suspense } from 'react'
import { CirclesList } from '@/components/app/circles'
import { Side } from '@/components/app/side'
import { StepCard } from '@/components/app/step-card'
import { PromptButton } from '@/components/feed/prompt'
import { FeedList } from '@/components/feed/feed-list'
import { TabBar } from '@/components/tab-bar'
import { db } from '@/db'
import { circles } from '@/db/schema'
import { getFeed, type FeedView } from '@/lib/server/posts'
import { requireViewer } from '@/lib/server/session'
import { m } from '@/messages'
import { currentStep, presenceCounts, touchCircle } from '../../actions'

export const metadata: Metadata = { title: m.feed.title }

type Search = Promise<{ ansicht?: string; kreis?: string }>

/** ?kreis=meine – Filter auf alle Kreise, denen die Person folgt. */
const MINE = 'meine'

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
      {/* Die Leiste steht sofort – sonst bleibt sie leer, bis die Daten da sind (auch beim Wechsel der Ansicht). */}
      <Side
        circles={
          <Suspense fallback={<CirclesList presence={{}} />}>
            <SidePresence />
          </Suspense>
        }
        step={
          <Suspense fallback={<div className="step step-wait" aria-hidden="true" />}>
            <SideStep />
          </Suspense>
        }
      />
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
        <h1>{m.feed.title}</h1>
        <TabBar label={m.feed.tabsLabel} active={view} items={VIEWS.map((t) => ({ key: t.key, label: t.label, href: q(t.key) }))} />
      </div>
      <p className="manifest">
        {m.feed.manifest}
        {view === 'unheard' && (
          <>
            {' '}
            <Link href="/lichtung/wartet">{m.waiting.open} →</Link>
          </>
        )}
      </p>
      <PromptButton circle={circle === MINE ? null : circle} />
    </>
  )
}

async function Feed({ searchParams }: { searchParams: Search }) {
  const v = await requireViewer()
  const sp = await searchParams
  const view: FeedView = sp.ansicht === 'unheard' || sp.ansicht === 'brave' ? sp.ansicht : 'all'
  const mine = sp.kreis === MINE
  const [circle] = sp.kreis && !mine ? await db.select().from(circles).where(eq(circles.slug, sp.kreis)) : []
  if (circle) await touchCircle(circle.slug)
  const [page, step] = await Promise.all([getFeed({ viewerId: v.userId, view, circleId: circle?.id ?? null, followed: mine }), currentStep()])
  const params = new URLSearchParams()
  if (view !== 'all') params.set('ansicht', view)
  return (
    <>
      <FeedHead view={view} circle={mine ? MINE : (circle?.slug ?? null)} />
      {mine && (
        <div className="filter">
          <span>{m.feed.circle}</span>
          <Link href={params.size ? `/lichtung?${params}` : '/lichtung'} scroll={false} aria-label={m.feed.clearFilter(m.circles.mine)}>
            {m.feed.clearCircle(m.circles.mine)}
          </Link>
          <p className="circle-desc">{m.circles.mineHint}</p>
        </div>
      )}
      {circle && (
        <div className="filter">
          <span>{m.feed.circle}</span>
          <Link href={params.size ? `/lichtung?${params}` : '/lichtung'} scroll={false} aria-label={m.feed.clearFilter(circle.name)}>
            {m.feed.clearCircle(circle.name)}
          </Link>
          <p className="circle-desc">
            {circle.description} <span className="fine">{m.circles.rules}: {circle.rules}</span>
          </p>
        </div>
      )}
      {/* Unter 1200 px gibt es keine Seitenleiste – der kleine Schritt steht dann hier im Feed. */}
      <div className="step-inline">
        <StepCard initial={step} />
      </div>
      <FeedList
        key={`${view}:${mine ? MINE : (circle?.slug ?? '')}`}
        initial={page.posts}
        nextCursor={page.nextCursor}
        caughtUp={page.caughtUp}
        view={view}
        circle={mine ? MINE : (circle?.slug ?? null)}
      />
    </>
  )
}

async function SidePresence() {
  await requireViewer()
  return <CirclesList presence={await presenceCounts()} />
}

async function SideStep() {
  await requireViewer()
  return <StepCard initial={await currentStep()} />
}

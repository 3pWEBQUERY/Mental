import type { Metadata } from 'next'
import Link from 'next/link'
import { and, count, desc, eq, gt, isNotNull, isNull } from 'drizzle-orm'
import { Suspense } from 'react'
import { Loading } from '@/components/ui'
import { PostList } from '@/components/feed/post-list'
import { Journal } from '@/components/me/journal'
import { db } from '@/db'
import { breathLog, checkins, posts, replies, stepLog } from '@/db/schema'
import { getBookmarkedPosts, getMyPosts } from '@/lib/server/posts'
import { requireViewer, type Viewer } from '@/lib/server/session'
import { formatDate, zurichDay } from '@/lib/time'
import { m } from '@/messages'
import { journalState } from './actions'

export const metadata: Metadata = { title: m.me.title }

const TABS = ['verlauf', 'gedanken', 'gutgetan', 'merkliste', 'tagebuch'] as const
type Tab = (typeof TABS)[number]
const LABEL: Record<Tab, string> = {
  verlauf: m.me.tabs.history,
  gedanken: m.me.tabs.posts,
  gutgetan: m.me.tabs.saved,
  merkliste: m.me.tabs.bookmarks,
  tagebuch: m.me.tabs.journal,
}

export default function MePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  return (
    <main className="page" id="inhalt">
      <Suspense fallback={<Loading />}>
        <Me searchParams={searchParams} />
      </Suspense>
    </main>
  )
}

async function Me({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const v = await requireViewer()
  const sp = await searchParams
  const tab: Tab = TABS.includes(sp.tab as Tab) ? (sp.tab as Tab) : 'verlauf'
  return (
    <>
      <div className="feed-head">
        <h1 className="page-title">{m.me.title}</h1>
        <Link className="btn ghost small" href="/einstellungen">
          {m.nav.settings}
        </Link>
      </div>
      <p className="manifest">{m.me.intro}</p>
      <nav className="tabs" aria-label={m.me.title} style={{ marginBottom: 24, width: 'fit-content' }}>
        {TABS.map((t) => (
          <Link key={t} className="tab" href={t === 'verlauf' ? '/ich' : `/ich?tab=${t}`} aria-current={tab === t ? 'page' : undefined} scroll={false}>
            {LABEL[t]}
          </Link>
        ))}
      </nav>
      {tab === 'verlauf' && <History v={v} />}
      {tab === 'gedanken' && <PostList initial={await getMyPosts(v.userId)} empty={m.me.postsEmpty} />}
      {tab === 'gutgetan' && <Saved v={v} />}
      {tab === 'merkliste' && <PostList initial={await getBookmarkedPosts(v.userId)} empty={m.me.bookmarksEmpty} />}
      {tab === 'tagebuch' && <Journal state={await journalState()} />}
    </>
  )
}

/** Ruhige Punktreihe der letzten 30 Tage. Keine Durchschnitte, keine Wertungen. */
async function History({ v }: { v: Viewer }) {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const [rows, [breaths], [stepsDone]] = await Promise.all([
    db
      .select({ mood: checkins.mood, note: checkins.note, createdAt: checkins.createdAt })
      .from(checkins)
      .where(and(eq(checkins.userId, v.userId), gt(checkins.createdAt, since)))
      .orderBy(checkins.createdAt),
    db.select({ n: count() }).from(breathLog).where(eq(breathLog.userId, v.userId)),
    db.select({ n: count() }).from(stepLog).where(and(eq(stepLog.userId, v.userId), eq(stepLog.action, 'done'))),
  ])
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000)
    return { key: zurichDay(d), date: d }
  })
  const byDay = new Map<string, number[]>()
  for (const r of rows) {
    const k = zurichDay(r.createdAt)
    byDay.set(k, [...(byDay.get(k) ?? []), r.mood])
  }
  const notes = rows.filter((r) => r.note).reverse()
  return (
    <section>
      <h2 className="section-label">{m.me.historyTitle}</h2>
      {rows.length === 0 ? (
        <p className="notice">{m.me.historyEmpty}</p>
      ) : (
        <>
          {/* Nicht nur Farbe: jeder Tag nennt seine Stimmungen auch als Text (für Screenreader). */}
          <div className="history" aria-label={m.me.historyLabel(rows.length)} role="list">
            {days.map((d) => (
              <div key={d.key} className="day" role="listitem" title={formatDate(d.date, { weekday: 'short', day: 'numeric', month: 'short' })}>
                <span className="sr-only">
                  {formatDate(d.date, { weekday: 'long', day: 'numeric', month: 'long' })}:{' '}
                  {(byDay.get(d.key) ?? []).map((mood) => m.moods.labels[mood]).join(', ') || m.me.historyNone}
                </span>
                <span aria-hidden="true">{d.date.getDate() === 1 || d.key === days[0]!.key ? formatDate(d.date, { day: 'numeric', month: 'short' }) : ''}</span>
                {(byDay.get(d.key) ?? []).map((mood, i) => (
                  <i key={i} aria-hidden="true" style={{ background: `var(--mood-${mood})` }} title={m.moods.labels[mood]} />
                ))}
              </div>
            ))}
          </div>
          <div className="history-legend">
            {m.moods.labels.map((l, i) => (
              <span key={l}>
                <i style={{ background: `var(--mood-${i})` }} />
                {l}
              </span>
            ))}
          </div>
          <p className="fine" style={{ marginTop: 8 }}>
            {m.me.historyLegend}
          </p>
        </>
      )}
      <div className="stats">
        <span>{m.me.breaths(breaths?.n ?? 0)}</span>
        <span>{m.me.stepsDone(stepsDone?.n ?? 0)}</span>
      </div>
      {notes.length > 0 && (
        <>
          <h2 className="section-label" style={{ marginTop: 32 }}>
            {m.me.notes}
          </h2>
          <ul className="note-list">
            {notes.map((n) => (
              <li key={n.createdAt.toISOString()}>
                <small>
                  {formatDate(n.createdAt, { weekday: 'long', day: 'numeric', month: 'long' })} · {m.moods.labels[n.mood]}
                </small>
                <p>{n.note}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

async function Saved({ v }: { v: Viewer }) {
  const rows = await db
    .select({ id: replies.id, body: replies.body, handle: replies.authorHandle, createdAt: replies.createdAt, postBody: posts.body })
    .from(replies)
    .innerJoin(posts, eq(posts.id, replies.postId))
    .where(and(eq(posts.userId, v.userId), eq(replies.helpful, true), isNull(replies.deletedAt), isNull(posts.deletedAt), isNotNull(replies.body)))
    .orderBy(desc(replies.createdAt))
  return (
    <section>
      <h2 className="section-label">{m.me.savedTitle}</h2>
      {rows.length === 0 ? (
        <p className="notice">{m.me.savedEmpty}</p>
      ) : (
        <ul>
          {rows.map((r) => (
            <li key={r.id} className="saved-reply">
              <blockquote>«{r.body}»</blockquote>
              <small>
                {r.handle} · {formatDate(r.createdAt)} · zu «{r.postBody.length > 60 ? `${r.postBody.slice(0, 58)} …` : r.postBody}»
              </small>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

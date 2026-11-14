'use client'

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { emit, on } from '@/lib/client/bus'
import type { PublicPost } from '@/lib/dto'
import { m } from '@/messages'
import { PostCard } from './post-card'
import { ReportDialog, type ReportTarget } from './report-dialog'

const postPath = (id: string) => `/start/gedanke/${id}`

/**
 * Die Gedanken-Spalte. Ein angeklickter Gedanke öffnet sich in ihr selbst (wie bei X oder Reddit) statt in einem
 * Dialog: Der Feed bleibt unsichtbar stehen (Zustand, geladene Seiten, Entwürfe), oben links führt «Zurück» genau
 * dorthin zurück, wo man war. Die Adresse wird zu /start/gedanke/<id> – Neu laden und Teilen zeigen denselben
 * Gedanken, und die Zurück-Taste des Browsers schliesst ihn wieder.
 */
export function FeedColumn({ children }: { children: ReactNode }) {
  const [post, setPost] = useState<PublicPost | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [report, setReport] = useState<ReportTarget>(null)
  const top = useRef<HTMLDivElement>(null)
  const back = useRef<HTMLButtonElement>(null)
  /** Scrollposition des Feeds und der Gedanke, von dem man kam – für die Rückkehr an dieselbe Stelle. */
  const from = useRef<{ y: number; id: string } | null>(null)
  const pushed = useRef(false)
  /** Zuletzt geöffneter Gedanke – die Vorwärts-Taste des Browsers öffnet ihn wieder. */
  const last = useRef<PublicPost | null>(null)

  useEffect(
    () =>
      on('open-post', (p) => {
        from.current = { y: window.scrollY, id: p.id }
        last.current = p
        setLeaving(false)
        setPost(p)
        if (location.pathname !== postPath(p.id)) {
          history.pushState(history.state, '', postPath(p.id))
          pushed.current = true
        }
      }),
    [],
  )
  // Antworten, Zuspruch und Bearbeiten im geöffneten Gedanken gelten auch für die Karte im Feed (und umgekehrt).
  useEffect(
    () =>
      on('post-updated', (p) => {
        if (last.current?.id === p.id) last.current = p
        setPost((cur) => (cur && cur.id === p.id ? p : cur))
      }),
    [],
  )

  // Zurück-Taste des Browsers (oder Wischgeste): Adresse ist nicht mehr die des Gedankens → schliessen.
  // Vorwärts-Taste: wieder die Adresse des zuletzt geöffneten Gedankens → ihn wieder öffnen.
  useEffect(() => {
    const onPop = () => {
      const p = last.current
      if (p && location.pathname === postPath(p.id)) {
        from.current = { y: window.scrollY, id: p.id }
        pushed.current = true
        setLeaving(false)
        setPost(p)
      } else if (!location.pathname.startsWith('/start/gedanke/')) {
        pushed.current = false
        close()
      }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // Esc schliesst wie «Zurück» – ausser ein Dialog oder Menü darüber fängt es ab.
  useEffect(() => {
    if (!post) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented && !document.querySelector('dialog[open]')) goBack()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [post])

  // Geöffnet: an den Anfang der Spalte, Fokus auf «Zurück». Geschlossen: zurück an die alte Stelle im Feed.
  useLayoutEffect(() => {
    if (post) {
      const y = (top.current?.getBoundingClientRect().top ?? 0) + window.scrollY - 12
      window.scrollTo({ top: Math.max(0, Math.min(window.scrollY, y)) })
      back.current?.focus({ preventScroll: true })
    } else if (from.current) {
      const { y, id } = from.current
      from.current = null
      window.scrollTo({ top: y })
      // Fokus zurück auf den Gedanken, von dem man kam (Tastatur, Screenreader).
      const card = document.querySelector<HTMLElement>(`[aria-labelledby="p-${id}"]`)
      if (card) {
        card.tabIndex = -1
        card.focus({ preventScroll: true })
      }
    }
  }, [post])

  function close() {
    setLeaving(true)
    setPost(null)
  }

  function goBack() {
    // Selbst geöffnet: über den Verlauf zurück (dann stimmt auch die Adresse); sonst direkt schliessen.
    if (pushed.current) history.back()
    else close()
  }

  return (
    <div ref={top} className="feed-column">
      <div className={`feed-main${leaving ? ' returning' : ''}`} hidden={Boolean(post)}>
        {children}
      </div>
      {post && (
        <section className="post-view" aria-label={m.feed.postDialog}>
          <div className="post-view-bar">
            <button ref={back} type="button" className="post-view-back" onClick={goBack}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M19 12H5M11 6l-6 6 6 6" />
              </svg>
              {m.common.back}
            </button>
            <h2>{m.feed.postDialog}</h2>
          </div>
          <PostCard
            key={post.id}
            post={post}
            onChange={(p) => {
              setPost(p)
              emit('post-updated', p)
            }}
            onRemove={(id) => {
              emit('post-removed', id)
              goBack()
            }}
            onReport={setReport}
            defaultOpen
          />
        </section>
      )}
      <ReportDialog target={report} onClose={() => setReport(null)} />
    </div>
  )
}

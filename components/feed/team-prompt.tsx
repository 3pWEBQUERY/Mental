'use client'

import { useEffect, type CSSProperties } from 'react'
import { emit } from '@/lib/client/bus'
import { m } from '@/messages'

export type TeamPromptView = { id: string; text: string; circle: { slug: string; name: string; color: string } }

/**
 * «Frage vom Team Jiaia»: deutlich als Frage des Teams gekennzeichnet (nie als Mitglied). Ein Klick öffnet das
 * Schreibfeld im Kreis der Frage – geteilt wird ein ganz normaler eigener Gedanke.
 * Im Kreis stehen alle seine Fragen (showCircle=false), in «Alle» bei jedem Laden eine andere samt Kreis.
 */
export function TeamPrompts({ prompts, showCircle = false }: { prompts: TeamPromptView[]; showCircle?: boolean }) {
  const shownId = showCircle ? prompts[0]?.id : undefined
  // «Alle»: gezeigte Frage merken – der Server wählt beim nächsten Laden eine andere (LAST_PROMPT_COOKIE).
  useEffect(() => {
    if (shownId) document.cookie = `jiaia_tp=${shownId}; path=/; max-age=2592000; samesite=lax`
  }, [shownId])
  if (!prompts.length) return null
  const t = m.feed.teamPrompt
  const [first, ...rest] = prompts
  const open = (p: TeamPromptView) => emit('compose', { prompt: { id: p.id, text: p.text, circle: p.circle.slug } })
  return (
    <section className="team-prompt" aria-label={t.eyebrow} style={{ '--c': first!.circle.color } as CSSProperties}>
      <p className="team-prompt-head">
        <span className="team-badge">
          {/* eslint-disable-next-line @next/next/no-img-element -- statisches SVG-Logo */}
          <img src="/jiaia-logo.svg" alt="" width={374} height={614} decoding="async" />
          {t.eyebrow}
        </span>
        {showCircle && <span className="team-prompt-circle">{first!.circle.name}</span>}
      </p>
      <button type="button" className="team-prompt-main" onClick={() => open(first!)}>
        <span className="team-prompt-q">{first!.text}</span>
        <span className="team-prompt-go">
          {t.share}
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </span>
      </button>
      {rest.length > 0 && (
        <ul className="team-prompt-more" aria-label={t.others}>
          {rest.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => open(p)}>
                {p.text}
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

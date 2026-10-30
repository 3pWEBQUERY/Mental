'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { m } from '@/messages'
import { useViewer } from '../viewer'

/** Dunkle Kreisfarbe (Trauer) folgt im Dunkelmodus der Textfarbe, damit der Punkt sichtbar bleibt. */
export function circleColor(c: string) {
  return c.toLowerCase() === '#1c1c1a' ? 'var(--ink)' : c
}

export function CirclesList({ presence, onPick }: { presence: Record<string, number | null>; onPick?: () => void }) {
  const viewer = useViewer()
  const params = useSearchParams()
  const active = params.get('kreis')
  return (
    <ul className="circles">
      {viewer.circles.map((c) => {
        const here = presence[c.slug]
        const on = active === c.slug
        const q = new URLSearchParams(params.toString())
        if (on) q.delete('kreis')
        else q.set('kreis', c.slug)
        q.delete('cursor')
        return (
          <li key={c.slug}>
            <Link
              className="circle"
              href={`/lichtung${q.size ? `?${q}` : ''}`}
              aria-current={on ? 'page' : undefined}
              onClick={onPick}
              scroll={false}
            >
              <i className="dot" style={{ background: circleColor(c.color) }} />
              <span>{c.name}</span>
              {!viewer.hidePresence && here !== 0 && here !== undefined && <small>{m.circles.here(here)}</small>}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

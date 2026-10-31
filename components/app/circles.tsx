'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { type ReactNode, useEffect, useState } from 'react'
import { m } from '@/messages'
import { useBlob } from '../use-blob'
import { useViewer } from '../viewer'

/** Gleich wie --r-m: Die Kreisliste ist eckiger als die Pillen der Reiter. */
const RADIUS = 12

/** Dunkle Kreisfarbe (Trauer) folgt im Dunkelmodus der Textfarbe, damit der Punkt sichtbar bleibt. */
export function circleColor(c: string) {
  return c.toLowerCase() === '#1c1c1a' ? 'var(--ink)' : c
}

export function CirclesList({ presence, onPick }: { presence: Record<string, number | null>; onPick?: () => void }) {
  const viewer = useViewer()
  const params = useSearchParams()
  const active = params.get('kreis')
  // Sofort fliessen lassen; die URL bestätigt danach (auch Zurück/Vor).
  const [picked, setPicked] = useState(active)
  useEffect(() => setPicked(active), [active])
  const { host, on, layers } = useBlob<HTMLUListElement>(picked, { radius: RADIUS })

  const items: { key: string; href: string; body: ReactNode }[] = []
  if (viewer.following.length > 0) {
    const q = new URLSearchParams(params.toString())
    if (active === 'meine') q.delete('kreis')
    else q.set('kreis', 'meine')
    q.delete('cursor')
    items.push({
      key: 'meine',
      href: `/start${q.size ? `?${q}` : ''}`,
      body: (
        <>
          <i className="dot" style={{ background: 'transparent', border: '1.5px solid var(--ink)' }} />
          <span>{m.circles.mine}</span>
          <small>{viewer.following.length}</small>
        </>
      ),
    })
  }
  for (const c of viewer.circles) {
    const here = presence[c.slug]
    const q = new URLSearchParams(params.toString())
    if (active === c.slug) q.delete('kreis')
    else q.set('kreis', c.slug)
    q.delete('cursor')
    items.push({
      key: c.slug,
      href: `/start${q.size ? `?${q}` : ''}`,
      body: (
        <>
          <i className="dot" style={{ background: circleColor(c.color) }} />
          <span>{c.name}</span>
          {!viewer.hidePresence && here !== 0 && here !== undefined && <small>{m.circles.here(here)}</small>}
        </>
      ),
    })
  }

  return (
    <ul ref={host} className={`circles${on ? ' blob-on' : ''}`}>
      {layers(
        items.map((i) => (
          <span key={i.key} className={`circle blob-copy${i.key === 'meine' ? ' mine' : ''}`}>
            {i.body}
          </span>
        )),
      )}
      {items.map((i) => (
        <li key={i.key}>
          <Link
            className={`circle${i.key === 'meine' ? ' mine' : ''}`}
            data-blob={i.key}
            href={i.href}
            aria-current={picked === i.key ? 'true' : undefined}
            onClick={(e) => {
              if (!(e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0)) setPicked(picked === i.key ? null : i.key)
              onPick?.()
            }}
            scroll={false}
          >
            {i.body}
          </Link>
        </li>
      ))}
    </ul>
  )
}

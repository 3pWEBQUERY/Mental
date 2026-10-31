'use client'

import { m } from '@/messages'
import dynamic from 'next/dynamic'
import { useState } from 'react'
import { glyphPath } from '@/lib/glyph'
import { LIGHT, PEOPLE, VIEW_HEIGHT } from './scene'

/** Gleiche Komposition als ruhiges SVG – sichtbar bis Three.js geladen ist, und ohne WebGL. */
function Still() {
  const h = VIEW_HEIGHT
  const w = 8.2
  const toX = (x: number) => ((x + w / 2) / w) * 400
  const toY = (y: number) => ((h / 2 - y) / h) * 400
  const unit = 400 / w
  const blob = (seed: number, cx: number, cy: number, rx: number, ry: number, fill: string, key: string) => (
    <path
      key={key}
      d={glyphPath(seed, 2)}
      transform={`translate(${cx - 20 * (rx / 15)} ${cy - 20 * (ry / 15)}) scale(${rx / 15} ${ry / 15})`}
      style={{ fill }}
    />
  )
  return (
    <svg className="gathering-still" viewBox="0 0 400 400" aria-hidden="true">
      {blob(11, toX(LIGHT.x), toY(LIGHT.y - 0.35), LIGHT.r * 3.4 * unit, LIGHT.r * 3.1 * unit, 'var(--clay-soft)', 'glow')}
      <path
        d={`M${toX(LIGHT.x)} ${toY(LIGHT.y + 1.25)}C${toX(LIGHT.x + 0.55)} ${toY(LIGHT.y + 0.45)} ${toX(LIGHT.x + 0.95)} ${toY(LIGHT.y - 0.2)} ${toX(LIGHT.x)} ${toY(LIGHT.y - 1.1)}C${toX(LIGHT.x - 0.95)} ${toY(LIGHT.y - 0.2)} ${toX(LIGHT.x - 0.55)} ${toY(LIGHT.y + 0.45)} ${toX(LIGHT.x)} ${toY(LIGHT.y + 1.25)}Z`}
        style={{ fill: 'var(--clay)' }}
      />
      {PEOPLE.map((p) => blob(Math.round(p.seed * 1000), toX(p.x), toY(p.y), p.r * unit, p.r * unit, `var(--mood-${p.mood})`, String(p.seed)))}
    </svg>
  )
}

// Three.js wird erst im Browser nachgeladen und blockiert den ersten Paint nicht.
const Gathering = dynamic(() => import('./gathering'), { ssr: false, loading: Still })

export function HeroArt() {
  const [webgl, setWebgl] = useState(true)
  return (
    <div
      className="landing-art"
      role="img"
      aria-label={m.landing.heroArt}
    >
      {webgl ? <Gathering onUnavailable={() => setWebgl(false)} /> : <Still />}
    </div>
  )
}

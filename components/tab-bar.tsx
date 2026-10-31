'use client'

import Link from 'next/link'
import { type CSSProperties, type ReactNode, useEffect, useState } from 'react'
import { useBlob } from './use-blob'

type Item = { key: string; label: ReactNode; href: string }

/**
 * Reiter-Leiste mit Links (Feed-Ansichten, «Ich», Admin). Der aktive Reiter ist ein Three.js-Tropfen, der beim
 * Wechsel zum neuen Reiter fliesst – auch in die nächste Zeile, wenn die Leiste umbricht.
 * Ohne WebGL oder bei reduzierter Bewegung bleibt die CSS-Pille.
 */
export function TabBar({
  items,
  active,
  label,
  style,
  keepScroll = true,
}: {
  items: Item[]
  active: string
  label: string
  style?: CSSProperties
  /** Ansichten derselben Seite behalten die Scrollposition; eigene Seiten (Admin) beginnen oben. */
  keepScroll?: boolean
}) {
  const [current, setCurrent] = useState(active)
  // Der Server bestätigt die Ansicht (auch Zurück/Vor im Browser).
  useEffect(() => setCurrent(active), [active])
  const { host, on, layers } = useBlob<HTMLElement>(current)

  return (
    <nav ref={host} className={`tabs${on ? ' blob-on' : ''}`} aria-label={label} style={style}>
      {layers(items, 'tab')}
      {items.map((t) => (
        <Link
          key={t.key}
          data-blob={t.key}
          className="tab"
          href={t.href}
          aria-current={current === t.key ? 'page' : undefined}
          scroll={!keepScroll}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
            // Sofort fliessen lassen – der Inhalt lädt währenddessen nach.
            setCurrent(t.key)
          }}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  )
}

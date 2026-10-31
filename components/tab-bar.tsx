'use client'

import Link from 'next/link'
import { type CSSProperties, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Box, TabBlob } from './tab-blob'

type Item = { key: string; label: ReactNode; href: string }

function reducedMotion() {
  return Boolean(document.documentElement.dataset.motion) || matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Reiter-Leiste mit Links (Feed-Ansichten, «Ich»). Der aktive Reiter ist ein Three.js-Tropfen, der beim
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
  const nav = useRef<HTMLElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const ink = useRef<HTMLDivElement>(null)
  const lastBox = useRef<Box | null>(null)
  const blob = useRef<TabBlob | null>(null)
  const [current, setCurrent] = useState(active)
  const [gl, setGl] = useState(false)

  // Der Server bestätigt die Ansicht (auch Zurück/Vor im Browser).
  useEffect(() => setCurrent(active), [active])

  function boxOf(key: string) {
    const el = nav.current?.querySelector<HTMLElement>(`[data-tab="${key}"]`)
    if (!el) return null
    return { left: el.offsetLeft, top: el.offsetTop, right: el.offsetLeft + el.offsetWidth, bottom: el.offsetTop + el.offsetHeight }
  }

  // Helle Kopie der Beschriftung, ausgeschnitten auf die Form des Tropfens: Die Schrift kippt
  // Buchstabe für Buchstabe von dunkel zu hell, während er darüber fliesst.
  function clipInk() {
    const el = ink.current
    const box = lastBox.current
    if (!el) return
    if (!box) {
      el.style.clipPath = 'inset(50%)'
      return
    }
    const r = (box.bottom - box.top) / 2
    el.style.clipPath = `inset(${box.top}px ${el.clientWidth - box.right}px ${el.clientHeight - box.bottom}px ${box.left}px round ${r}px)`
  }
  useLayoutEffect(clipInk, [gl])

  useEffect(() => {
    if (reducedMotion()) return
    let alive = true
    let ro: ResizeObserver | null = null
    let mo: MutationObserver | null = null
    import('./tab-blob').then(({ createTabBlob }) => {
      if (!alive || !canvas.current || !nav.current) return
      const b = createTabBlob(canvas.current, (box) => {
        lastBox.current = box
        clipInk()
      })
      if (!b) return
      blob.current = b
      let first = true
      const fit = () => {
        if (!nav.current) return
        b.resize(nav.current.clientWidth, nav.current.clientHeight)
        const box = boxOf(currentRef.current)
        // Nur beim Aufbau springen. Später (Scrollbalken, Schriftgrösse, Zeilenumbruch) nur neu zielen –
        // sonst würde eine Grössenänderung mitten im Wechsel die Bewegung abschneiden.
        if (box) b.moveTo(box, first)
        else b.hide()
        first = false
      }
      fit()
      ro = new ResizeObserver(fit)
      ro.observe(nav.current)
      // Hell/Dunkel: Tintenfarbe neu lesen.
      mo = new MutationObserver(() => b.recolor())
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
      setGl(true)
    })
    return () => {
      alive = false
      ro?.disconnect()
      mo?.disconnect()
      blob.current?.dispose()
      blob.current = null
    }
  }, [])

  const currentRef = useRef(current)
  useLayoutEffect(() => {
    currentRef.current = current
    const box = boxOf(current)
    if (box) blob.current?.moveTo(box)
    else blob.current?.hide()
  }, [current])

  return (
    <nav ref={nav} className={`tabs${gl ? ' tabs-gl' : ''}`} aria-label={label} style={style}>
      <canvas ref={canvas} className="tabs-canvas" aria-hidden="true" />
      {gl && (
        <div ref={ink} className="tabs-ink" aria-hidden="true">
          {items.map((t) => (
            <span key={t.key} className="tab">
              {t.label}
            </span>
          ))}
        </div>
      )}
      {items.map((t) => (
        <Link
          key={t.key}
          data-tab={t.key}
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

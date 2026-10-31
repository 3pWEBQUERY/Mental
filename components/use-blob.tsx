'use client'

import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Box, TabBlob } from './tab-blob'

function reducedMotion() {
  return Boolean(document.documentElement.dataset.motion) || matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Der Three.js-Tropfen für Reiter-Leisten und Auswahlgruppen. Die Elemente tragen `data-blob="<key>"`;
 * der Tropfen fliesst zu dem mit `active`. Ohne WebGL oder bei reduzierter Bewegung bleibt `on` false
 * und die CSS-Pille übernimmt.
 *
 * Rückgabe: `host` an den Container, `on` als Klasse (`blob-on`), `layers(labels)` als erste Kinder.
 */
export function useBlob<T extends HTMLElement>(active: string | null, enabled = true) {
  const host = useRef<T>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const ink = useRef<HTMLDivElement>(null)
  const lastBox = useRef<Box | null>(null)
  const blob = useRef<TabBlob | null>(null)
  const activeRef = useRef(active)
  const [on, setOn] = useState(false)

  function boxOf(key: string | null) {
    if (key === null) return null
    const el = host.current?.querySelector<HTMLElement>(`[data-blob="${CSS.escape(key)}"]`)
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
  useLayoutEffect(clipInk, [on])

  useEffect(() => {
    if (!enabled || reducedMotion()) return
    let alive = true
    let ro: ResizeObserver | null = null
    let mo: MutationObserver | null = null
    import('./tab-blob').then(({ createTabBlob }) => {
      if (!alive || !canvas.current || !host.current) return
      const b = createTabBlob(canvas.current, (box) => {
        lastBox.current = box
        clipInk()
      })
      if (!b) return
      blob.current = b
      let first = true
      const fit = () => {
        if (!host.current) return
        b.resize(host.current.clientWidth, host.current.clientHeight)
        const box = boxOf(activeRef.current)
        // Nur beim Aufbau springen. Später (Scrollbalken, Schriftgrösse, Zeilenumbruch) nur neu zielen –
        // sonst würde eine Grössenänderung mitten im Wechsel die Bewegung abschneiden.
        if (box) b.moveTo(box, first)
        else b.hide()
        first = false
      }
      fit()
      ro = new ResizeObserver(fit)
      ro.observe(host.current)
      // Hell/Dunkel: Tintenfarbe neu lesen.
      mo = new MutationObserver(() => b.recolor())
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
      setOn(true)
    })
    return () => {
      alive = false
      ro?.disconnect()
      mo?.disconnect()
      blob.current?.dispose()
      blob.current = null
    }
  }, [])

  useLayoutEffect(() => {
    activeRef.current = active
    const box = boxOf(active)
    // «Bewegung reduzieren» lässt sich mitten in der Sitzung einschalten (Einstellungen) – dann springen.
    if (box) blob.current?.moveTo(box, reducedMotion())
    else blob.current?.hide()
  }, [active])

  function layers(labels: { key: string; label: ReactNode }[], itemClassName?: string) {
    return (
      <>
        {enabled && <canvas ref={canvas} className="blob-canvas" aria-hidden="true" />}
        {on && (
          <div ref={ink} className="blob-ink" aria-hidden="true">
            {labels.map((l) => (
              <span key={l.key} className={itemClassName}>
                {l.label}
              </span>
            ))}
          </div>
        )}
      </>
    )
  }

  return { host, on, layers }
}

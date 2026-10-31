'use client'

import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { DropField } from './drop-field'
import type { Box } from './tab-blob'

function reducedMotion() {
  return Boolean(document.documentElement.dataset.motion) || matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Abgerundete Rechtecke (Pillen) als ein Pfad – für clip-path über mehrere Tropfen. */
function pillsPath(boxes: Box[]) {
  return boxes
    .filter((b) => b.right - b.left > 0.5 && b.bottom - b.top > 0.5)
    .map(({ left: l, top: t, right: r, bottom: b }) => {
      const k = Math.min((r - l) / 2, (b - t) / 2)
      return `M${l + k},${t}H${r - k}A${k},${k} 0 0 1 ${r},${t + k}V${b - k}A${k},${k} 0 0 1 ${r - k},${b}H${l + k}A${k},${k} 0 0 1 ${l},${b - k}V${t + k}A${k},${k} 0 0 1 ${l + k},${t}Z`
    })
    .join('')
}

/**
 * Tropfen für einzeln schaltbare Knöpfe (`data-drop="<key>"`, an = in `pressed`). Aufgebaut wird erst bei
 * Annäherung (Maus, Fokus, Finger) und wieder freigegeben, sobald die Bewegung vorbei ist und der Zeiger weg –
 * im Feed stehen viele Gedanken, Browser erlauben nur wenige WebGL-Kontexte. Dazwischen zeigt CSS denselben
 * Zustand (gefüllte Pille), der Wechsel ist unsichtbar.
 *
 * Rückgabe wie bei useBlob: `host`, `on` (Klasse `blob-on`), `layers(copy)`.
 */
export function useDrops<T extends HTMLElement>(pressed: string[], color: string) {
  const host = useRef<T>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const ink = useRef<HTMLDivElement>(null)
  const field = useRef<DropField | null>(null)
  const boxes = useRef<Box[]>([])
  const pressedRef = useRef(pressed)
  const synced = useRef(pressed)
  const atStart = useRef<string[]>([])
  const origin = useRef<{ x: number; y: number } | null>(null)
  const near = useRef(false)
  const live = useRef(false)
  const count = useRef(0)
  // Jede Runde bekommt ein frisches Canvas: Ein freigegebener (verlorener) Kontext lässt sich nicht wiederverwenden.
  const [gen, setGen] = useState(0)
  const [on, setOn] = useState(false)

  function boxOf(key: string): Box | null {
    const el = host.current?.querySelector<HTMLElement>(`[data-drop="${CSS.escape(key)}"]`)
    if (!el) return null
    return { left: el.offsetLeft, top: el.offsetTop, right: el.offsetLeft + el.offsetWidth, bottom: el.offsetTop + el.offsetHeight }
  }

  function clip() {
    const el = ink.current
    if (!el) return
    const d = pillsPath(boxes.current)
    el.style.clipPath = d ? `path('${d}')` : 'inset(50%)'
  }
  useLayoutEffect(clip, [on])

  const timer = useRef(0)
  // Mit kurzer Verzögerung freigeben: Wer über den Feed fährt, soll nicht bei jedem Gedanken einen Kontext auf- und abbauen.
  // Knöpfe, deren Tropfen sich gerade bewegt, zeichnen sich ungefüllt (CSS: [data-busy]); ruhende gedrückte Knöpfe
  // sehen mit und ohne Canvas gleich aus – so bleibt das Freigeben des Kontexts unsichtbar.
  function mark(moving: string[]) {
    host.current?.querySelectorAll<HTMLElement>('[data-drop]').forEach((el) => {
      if (moving.includes(el.dataset.drop!)) el.setAttribute('data-busy', '')
      else el.removeAttribute('data-busy')
    })
  }

  function release() {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      if (near.current || !field.current || field.current.busy) return
      live.current = false
      setOn(false)
      setGen(0)
    }, 1500)
  }
  const releaseRef = useRef(release)
  releaseRef.current = release

  useEffect(() => {
    const el = host.current
    if (!el || reducedMotion()) return
    const enter = () => {
      near.current = true
      window.clearTimeout(timer.current)
      if (live.current) return
      live.current = true
      atStart.current = pressedRef.current
      setGen(++count.current)
    }
    const down = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      origin.current = { x: e.clientX - r.left, y: e.clientY - r.top }
      enter()
    }
    const leave = () => {
      near.current = false
      releaseRef.current()
    }
    const blur = (e: FocusEvent) => {
      if (!el.contains(e.relatedTarget as Node | null)) leave()
    }
    el.addEventListener('pointerenter', enter)
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointerleave', leave)
    el.addEventListener('focusin', enter)
    el.addEventListener('focusout', blur)
    return () => {
      window.clearTimeout(timer.current)
      el.removeEventListener('pointerenter', enter)
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointerleave', leave)
      el.removeEventListener('focusin', enter)
      el.removeEventListener('focusout', blur)
    }
  }, [])

  useEffect(() => {
    if (!gen) return
    let alive = true
    let ro: ResizeObserver | null = null
    let mo: MutationObserver | null = null
    let mq: MediaQueryList | null = null
    const recolorOs = () => field.current?.recolor()
    let self: DropField | null = null
    import('./drop-field').then(({ createDropField }) => {
      if (!alive || !canvas.current || !host.current) return
      const f = createDropField(canvas.current, {
        color,
        onFrame: (b, moving) => {
          boxes.current = b
          clip()
          mark(moving)
        },
        onIdle: () => releaseRef.current(),
        onLost: () => {
          // Nur für das aktuelle Feld – das eigene Freigeben (forceContextLoss) löst das Ereignis später auch aus.
          if (!field.current || field.current !== self) return
          field.current = null
          live.current = false
          setOn(false)
          setGen(0)
        },
      })
      if (!f) return
      self = f
      field.current = f
      const fit = () => {
        const el = host.current
        if (!el?.clientWidth) return
        f.resize(el.clientWidth, el.clientHeight)
      }
      fit()
      // Was beim Aufbau schon an war, steht sofort; was der Klick inzwischen geändert hat, bewegt sich.
      const now = pressedRef.current
      for (const k of atStart.current) {
        const box = boxOf(k)
        if (!box) continue
        f.fill(k, box, undefined, true)
        if (!now.includes(k)) f.drain(k)
      }
      for (const k of now) {
        const box = boxOf(k)
        if (box && !atStart.current.includes(k)) f.fill(k, box, origin.current ?? undefined)
      }
      synced.current = now
      origin.current = null
      // Layout ändert sich (Schriftgrösse, Umbruch): Tropfen ohne Bewegung neu anlegen.
      ro = new ResizeObserver(() => {
        fit()
        for (const k of synced.current) {
          const box = boxOf(k)
          if (box) f.fill(k, box, undefined, true)
        }
      })
      ro.observe(host.current)
      mo = new MutationObserver(() => f.recolor())
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
      // Farbschema «System»: Wechsel des Betriebssystems auf Dunkel mitnehmen.
      mq = matchMedia('(prefers-color-scheme: dark)')
      mq.addEventListener('change', recolorOs)
      setOn(true)
      // Kam der Zeiger nur vorbei, ohne etwas zu ändern: gleich wieder freigeben.
      if (!f.busy) releaseRef.current()
    })
    return () => {
      alive = false
      ro?.disconnect()
      mo?.disconnect()
      mq?.removeEventListener('change', recolorOs)
      field.current?.dispose()
      field.current = null
      boxes.current = []
      mark([])
    }
    // `color` ist pro Aufruf fest.
  }, [gen])

  // Änderungen pro Bild zusammenfassen: Nach der Server-Antwort springt der optimistische Zustand für ein paar
  // Millisekunden zurück und wieder vor – das darf keinen Tropfen leeren und neu füllen.
  const frame = useRef(0)
  function apply() {
    frame.current = 0
    const f = field.current
    if (!f) return
    const pressed = pressedRef.current
    const instant = reducedMotion()
    for (const k of pressed) {
      if (synced.current.includes(k)) continue
      const box = boxOf(k)
      if (box) f.fill(k, box, origin.current ?? undefined, instant)
    }
    for (const k of synced.current) if (!pressed.includes(k)) f.drain(k, instant)
    synced.current = pressed
    origin.current = null
  }
  const key = pressed.join('|')
  useLayoutEffect(() => {
    pressedRef.current = pressed
    if (!field.current) return
    // Schon vor dem ersten Bild als «in Bewegung» markieren, sonst blitzt die gefüllte CSS-Pille auf.
    const changed = [...pressed.filter((k) => !synced.current.includes(k)), ...synced.current.filter((k) => !pressed.includes(k))]
    if (changed.length) mark(changed)
    if (!frame.current) frame.current = requestAnimationFrame(apply)
  }, [key])
  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  function layers(copy: ReactNode) {
    if (!gen) return null
    return (
      <>
        <canvas key={gen} ref={canvas} className="blob-canvas" aria-hidden="true" />
        {on && (
          <div ref={ink} className="blob-ink" aria-hidden="true">
            {copy}
          </div>
        )}
      </>
    )
  }

  return { host, on, layers }
}

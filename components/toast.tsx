'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { on } from '@/lib/client/bus'

/**
 * Kurze Rückmeldungen. Ist ein modaler Dialog offen, erscheint die Meldung in ihm: Alles ausserhalb ist dann
 * inert – ein Toast im Body läge unsichtbar dahinter und würde von Screenreadern nicht angesagt.
 * Der Text kommt erst ein Bild nach der (leeren) Live-Region, damit er zuverlässig vorgelesen wird – auch
 * dieselbe Meldung zweimal hintereinander.
 */
export function Toaster() {
  const [msg, setMsg] = useState('')
  const [visible, setVisible] = useState(false)
  const [host, setHost] = useState<Element | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const frame = useRef(0)

  useEffect(
    () =>
      on('toast', (text) => {
        const modal = [...document.querySelectorAll('dialog[open]')].filter((d) => d.matches(':modal')).at(-1) ?? null
        setHost(modal)
        setMsg('')
        setVisible(true)
        cancelAnimationFrame(frame.current)
        frame.current = requestAnimationFrame(() => {
          frame.current = requestAnimationFrame(() => setMsg(text))
        })
        clearTimeout(timer.current)
        // Lange Meldungen (z. B. Fehler) bleiben länger stehen: ~60 ms pro Zeichen, 2.6 bis 8 s.
        timer.current = setTimeout(() => setVisible(false), Math.min(8000, Math.max(2600, 1200 + text.length * 60)))
      }),
    [],
  )
  // Schliesst sich der Dialog, in dem die Meldung steht, wandert sie zurück in den Body.
  useEffect(() => {
    if (!host) return
    const back = () => setHost(null)
    host.addEventListener('close', back)
    return () => host.removeEventListener('close', back)
  }, [host])

  const node = (
    <div className={`toast${visible && msg ? ' on' : ''}`} role="status" aria-live="polite">
      {msg}
    </div>
  )
  return host ? createPortal(node, host) : node
}

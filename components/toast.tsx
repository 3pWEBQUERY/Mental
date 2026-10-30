'use client'

import { useEffect, useRef, useState } from 'react'
import { on } from '@/lib/client/bus'

export function Toaster() {
  const [msg, setMsg] = useState('')
  const [visible, setVisible] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(
    () =>
      on('toast', (text) => {
        setMsg(text)
        setVisible(true)
        clearTimeout(timer.current)
        // Lange Meldungen (z. B. Fehler) bleiben länger stehen: ~60 ms pro Zeichen, 2.6 bis 8 s.
        timer.current = setTimeout(() => setVisible(false), Math.min(8000, Math.max(2600, 1200 + text.length * 60)))
      }),
    [],
  )

  return (
    <div className={`toast${visible ? ' on' : ''}`} role="status" aria-live="polite">
      {msg}
    </div>
  )
}

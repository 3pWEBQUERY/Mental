'use client'

import { useEffect } from 'react'
import { forgetPrivate } from '@/lib/client/private-storage'
import { m } from '@/messages'

/** Schnell ausblenden: Sitzung im Tab beenden und sofort auf eine neutrale Seite wechseln. */
export function panic() {
  try {
    navigator.sendBeacon('/api/panic')
  } catch {}
  try {
    sessionStorage.clear()
  } catch {}
  forgetPrivate()
  document.title = 'MeteoSchweiz'
  document.body.style.visibility = 'hidden'
  // replace(): Die Lichtung verschwindet aus dem Zurück-Verlauf dieses Tabs.
  window.location.replace(m.panic.target)
}

/** Dreimal Esc innerhalb von 1.5 Sekunden. */
export function PanicGuard() {
  useEffect(() => {
    let presses: number[] = []
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const now = Date.now()
      presses = [...presses.filter((t) => now - t < 1500), now]
      if (presses.length >= 3) panic()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])
  return null
}

export function PanicButton({ className = 'btn ghost small', label = m.settings.panic }: { className?: string; label?: string }) {
  return (
    <button type="button" className={className} onClick={panic}>
      {label}
    </button>
  )
}

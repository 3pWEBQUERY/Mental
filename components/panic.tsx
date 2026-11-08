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
  // replace(): Dieser Eintrag verschwindet aus dem Zurück-Verlauf. Frühere Jiaia-Seiten bleiben dort – ausser im
  // Diskret-Modus, der gar keine weiteren Einträge anlegt (components/discreet.tsx).
  window.location.replace(m.panic.target)
}

/** Dreimal Esc innerhalb von 1.5 Sekunden. */
export function PanicGuard() {
  useEffect(() => {
    let presses: number[] = []
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.repeat) return
      // Schliesst das Esc gerade einen Dialog oder ein Menü, zählt es nicht – sonst blendete «Menü zu, Dialog zu,
      // noch einmal» die App ungewollt aus.
      if (document.querySelector('dialog[open], [role="menu"]')) {
        presses = []
        return
      }
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

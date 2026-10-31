'use client'

import { useState, type ReactNode } from 'react'
import { m } from '@/messages'

/**
 * Belastende Inhalte (akut, Sorge) erscheinen in der Warteschlange erst weichgezeichnet. Moderierende entscheiden
 * selbst, wann sie hinsehen – Schutz vor Dauerbelastung, ohne etwas zu verstecken.
 */
export function Sensitive({ children, label }: { children: ReactNode; label: string }) {
  const [shown, setShown] = useState(false)
  if (shown) return <>{children}</>
  return (
    <div className="sensitive">
      <div className="sensitive-veil" aria-hidden="true">
        {children}
      </div>
      <button type="button" className="btn ghost small" onClick={() => setShown(true)}>
        {m.admin.reveal} <span className="sr-only">({label})</span>
      </button>
    </div>
  )
}

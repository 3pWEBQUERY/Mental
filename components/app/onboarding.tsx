'use client'

import { useEffect, useState } from 'react'
import { finishOnboarding } from '@/app/(app)/einstellungen/actions'
import { m } from '@/messages'
import { Dialog } from '../dialog'
import { useViewer } from '../viewer'

/**
 * Drei kurze Karten beim ersten Besuch: was Lichtung ist, wie man antwortet, wo Hilfe ist. Jederzeit
 * überspringbar, erscheint nur einmal. Keine Tour durch Knöpfe – nur das, was man wissen muss, um sich sicher zu fühlen.
 */
export function Onboarding() {
  const viewer = useViewer()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  // Erst nach dem Laden öffnen – nicht über einer Krise oder einem anderen Dialog, der beim Start aufgeht.
  useEffect(() => {
    if (!viewer.onboard) return
    const t = window.setTimeout(() => setOpen(true), 600)
    return () => window.clearTimeout(t)
  }, [viewer.onboard])

  const o = m.onboarding
  const card = o.cards[step]!
  const last = step === o.cards.length - 1
  function close() {
    setOpen(false)
    void finishOnboarding()
  }
  return (
    <Dialog open={open} onClose={close} title={o.title} className="onboarding">
      <div className="stack" style={{ gap: 14 }}>
        <p className="eyebrow">{o.progress(step + 1, o.cards.length)}</p>
        <h3 className="onboarding-title" key={step}>
          {card.title}
        </h3>
        <p>{card.body}</p>
        <ol className="grounding-dots" aria-hidden="true">
          {o.cards.map((c, i) => (
            <li key={c.title} className={i <= step ? 'on' : undefined} />
          ))}
        </ol>
        <div className="row" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" className="btn" data-autofocus onClick={() => (last ? close() : setStep(step + 1))}>
            {last ? o.done : o.next}
          </button>
          {!last && (
            <button type="button" className="btn ghost" onClick={close}>
              {o.skip}
            </button>
          )}
        </div>
      </div>
    </Dialog>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { on, pulse } from '@/lib/client/bus'
import { m } from '@/messages'
import { Dialog } from '../dialog'

/**
 * 5-4-3-2-1: zurück ins Hier und Jetzt über die Sinne – hilft bei Panik, wenn Atmen gerade nicht geht.
 * Bewusst ohne Animation und ohne Zeitdruck: ein Schritt pro Ansicht, weiter erst, wenn man so weit ist.
 */
export function Grounding() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  useEffect(
    () =>
      on('grounding', () => {
        setStep(0)
        setOpen(true)
      }),
    [],
  )
  const g = m.grounding
  const done = step >= g.steps.length
  const cur = g.steps[step]
  return (
    <Dialog open={open} onClose={() => setOpen(false)} title={g.title} className="grounding">
      {done ? (
        <div className="stack" style={{ gap: 14 }}>
          <p className="grounding-text">{g.done}</p>
          <div>
            <button type="button" className="btn" onClick={() => setOpen(false)} data-autofocus>
              {g.close}
            </button>
          </div>
        </div>
      ) : (
        <div className="stack" style={{ gap: 14 }}>
          {step === 0 && <p className="fine">{g.intro}</p>}
          <p className="grounding-count" aria-hidden="true">
            {cur!.n}
          </p>
          <p className="grounding-text" aria-live="polite">
            {cur!.text}
          </p>
          <p className="fine">{cur!.hint}</p>
          <ol className="grounding-dots" aria-label={g.progress(step + 1, g.steps.length)}>
            {g.steps.map((s, i) => (
              <li key={s.n} className={i <= step ? 'on' : undefined} />
            ))}
          </ol>
          <div>
            <button
              type="button"
              className="btn"
              data-autofocus
              onClick={() => {
                if (step === g.steps.length - 1) pulse()
                setStep(step + 1)
              }}
            >
              {g.next}
            </button>
          </div>
        </div>
      )}
    </Dialog>
  )
}

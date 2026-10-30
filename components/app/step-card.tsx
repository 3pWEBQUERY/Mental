'use client'

import { useState, useTransition } from 'react'
import { stepAction, type StepView } from '@/app/(app)/actions'
import { pulse, toast } from '@/lib/client/bus'
import { m } from '@/messages'

/** Ein kleiner Schritt für heute. Keine Streaks, keine Strafe beim Auslassen. */
export function StepCard({ initial }: { initial: StepView }) {
  const [step, setStep] = useState(initial)
  const [pending, start] = useTransition()
  if (!step) return null
  const s = m.step
  return (
    <section className={`step${step.done ? ' done' : ''}`} aria-live="polite">
      <div className="eyebrow">{s.eyebrow}</div>
      <p>{step.text}</p>
      {!step.done && (
        <div className="row">
          <button
            type="button"
            className="btn"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setStep(await stepAction(step.id, 'done'))
                pulse()
                toast(s.toast)
              })
            }
          >
            {s.done}
          </button>
          <button type="button" className="btn ghost" disabled={pending} onClick={() => start(async () => setStep(await stepAction(step.id, 'skip')))}>
            {s.other}
          </button>
        </div>
      )}
    </section>
  )
}

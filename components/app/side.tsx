'use client'

import { m } from '@/messages'
import type { StepView } from '@/app/(app)/actions'
import { HelpList } from '../ui'
import { useViewer } from '../viewer'
import { CirclesList } from './circles'
import { StepCard } from './step-card'

export function Side({ presence, step }: { presence: Record<string, number | null>; step: StepView }) {
  const viewer = useViewer()
  return (
    <aside className="side" aria-label="Seitenleiste">
      <section>
        <h3>{m.circles.title}</h3>
        <CirclesList presence={presence} />
      </section>
      <StepCard initial={step} />
      <section className="help">
        <HelpList resources={viewer.help.filter((h) => h.phone)} />
      </section>
      <p className="fine">{m.common.fine}</p>
    </aside>
  )
}

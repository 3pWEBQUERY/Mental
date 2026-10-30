'use client'

import { emit } from '@/lib/client/bus'
import { m } from '@/messages'

export function PromptButton({ circle }: { circle: string | null }) {
  return (
    <button type="button" className="prompt" onClick={() => emit('compose', circle ? { circle } : undefined)}>
      <span>{m.feed.prompt}</span>
      <i aria-hidden="true">+</i>
    </button>
  )
}

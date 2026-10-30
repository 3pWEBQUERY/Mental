'use client'

import { emit } from '@/lib/client/bus'
import { m } from '@/messages'

export function PromptButton({ circle }: { circle: string | null }) {
  return (
    <button type="button" className="prompt" onClick={() => emit('compose', circle ? { circle } : undefined)}>
      <span>{m.feed.prompt}</span>
      <i aria-hidden="true">
        <svg viewBox="0 0 20 20" width="20" height="20">
          <path d="M10 3v14M3 10h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
        </svg>
      </i>
    </button>
  )
}

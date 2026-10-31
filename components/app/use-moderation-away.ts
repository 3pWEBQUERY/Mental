'use client'

import { useEffect, useState } from 'react'
import { moderationAway } from '@/lib/moderation-hours'
import { useViewer } from '../viewer'

/** Ist das Team gerade nicht erreichbar? Erst nach dem Laden berechnet (Server und Browser haben andere Uhren). */
export function useModerationAway() {
  const { nightModeration } = useViewer()
  const [away, setAway] = useState(false)
  useEffect(() => {
    const tick = () => setAway(moderationAway(nightModeration))
    tick()
    const t = window.setInterval(tick, 60_000)
    return () => window.clearInterval(t)
  }, [nightModeration])
  return away
}

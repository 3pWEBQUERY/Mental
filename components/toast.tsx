'use client'

import { useEffect, useRef, useState } from 'react'
import { on } from '@/lib/client/bus'

export function Toaster() {
  const [msg, setMsg] = useState('')
  const [visible, setVisible] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(
    () =>
      on('toast', (text) => {
        setMsg(text)
        setVisible(true)
        clearTimeout(timer.current)
        timer.current = setTimeout(() => setVisible(false), 2600)
      }),
    [],
  )

  return (
    <div className={`toast${visible ? ' on' : ''}`} role="status" aria-live="polite">
      {msg}
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { m } from '@/messages'
import { Dialog } from './dialog'

type Request = { message: string; confirmLabel: string; resolve: (ok: boolean) => void }

/** Ruhige Bestätigung im Design der App – statt window.confirm. */
export function askConfirm(message: string, confirmLabel: string): Promise<boolean> {
  return new Promise((resolve) => {
    window.dispatchEvent(new CustomEvent<Request>('lichtung:confirm', { detail: { message, confirmLabel, resolve } }))
  })
}

export function ConfirmHost() {
  const [req, setReq] = useState<Request | null>(null)
  useEffect(() => {
    const onReq = (e: Event) => setReq((e as CustomEvent<Request>).detail)
    window.addEventListener('lichtung:confirm', onReq)
    return () => window.removeEventListener('lichtung:confirm', onReq)
  }, [])
  const answer = (ok: boolean) => {
    req?.resolve(ok)
    setReq(null)
  }
  return (
    <Dialog open={req !== null} onClose={() => answer(false)} title={req?.confirmLabel}>
      <p style={{ fontFamily: 'var(--serif)', fontSize: 'calc(22px * var(--fz))', lineHeight: 1.25 }}>{req?.message}</p>
      <div className="dlg-foot">
        <button type="button" className="btn ghost" onClick={() => answer(false)}>
          {m.common.cancel}
        </button>
        <button type="button" className="btn" onClick={() => answer(true)} autoFocus>
          {req?.confirmLabel}
        </button>
      </div>
    </Dialog>
  )
}

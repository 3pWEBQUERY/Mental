'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'
import { m } from '@/messages'

/** Nativer <dialog> mit Fokus-Falle, Esc und Klick auf den Hintergrund zum Schliessen. */
export function Dialog({
  open,
  onClose,
  title,
  children,
  className,
  wide,
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  className?: string
  wide?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const id = useId()
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className={className}
      aria-labelledby={title ? id : undefined}
      style={wide ? { width: 'min(760px, calc(100% - 24px))' } : undefined}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
    >
      {open && (
        <div className="dlg">
          {title && (
            <div className="dlg-head">
              <h2 id={id}>{title}</h2>
              <button type="button" className="x" onClick={onClose} aria-label={m.common.close}>
                ×
              </button>
            </div>
          )}
          {children}
        </div>
      )}
    </dialog>
  )
}

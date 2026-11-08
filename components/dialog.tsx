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
  label,
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  className?: string
  wide?: boolean
  /** Zugänglicher Name, wenn der Dialog keinen sichtbaren Titel über `title` hat. */
  label?: string
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const id = useId()
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      d.showModal()
      // showModal() fokussiert das erste Element (meist «×»). React-autoFocus läuft davor und geht verloren –
      // darum gezielt das mit data-autofocus markierte Element.
      d.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    }
    if (!open && d.open) d.close()
  }, [open])

  // «Zurück» im Browser schliesst einen offenen Dialog (wie man es vom Handy kennt). Und wird die Seite verborgen
  // (React Activity beim Seitenwechsel), schliesst er sich auch: Ein offener modaler Dialog machte sonst die neue
  // Seite unbedienbar (inert) – und stünde beim Zurückkehren noch offen da.
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  })
  useEffect(() => {
    if (!open) return
    const onPop = () => close.current()
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [open])
  useEffect(() => {
    // Das Element jetzt festhalten: Beim Verbergen löst React die Ref vor diesem Aufräumen.
    const d = ref.current
    return () => {
      if (d?.open) {
        d.close()
        close.current()
      }
    }
  }, [])

  return (
    <dialog
      ref={ref}
      className={className}
      aria-labelledby={title ? id : undefined}
      aria-label={!title ? label : undefined}
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

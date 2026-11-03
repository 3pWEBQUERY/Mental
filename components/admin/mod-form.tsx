'use client'

import type { ReactNode } from 'react'
import { useFormStatus } from 'react-dom'

type Action = (form: FormData) => void | Promise<void>

/**
 * Formular mit mehreren Entscheidungs-Knöpfen (Moderation, Einsprüche, Bildfreigabe):
 * - Enter im Begründungsfeld schickt nichts ab – sonst gälte der erste Knopf (z. B. «Verwarnen») als gedrückt;
 * - während die Aktion läuft, sind alle Knöpfe gesperrt – ein Doppelklick löst sie nicht zweimal aus.
 */
export function ModForm({ action, children, className, label }: { action: Action; children: ReactNode; className?: string; label?: string }) {
  return (
    <form action={action} className={className} aria-label={label} onKeyDown={blockEnter}>
      <Lock>{children}</Lock>
    </form>
  )
}

/** Enter in einem einzeiligen Feld: nicht abschicken, wenn das Formular mehrere Entscheidungs-Knöpfe hat. */
export function blockEnter(e: React.KeyboardEvent<HTMLFormElement>) {
  const t = e.target as HTMLElement
  if (e.key !== 'Enter' || t.tagName !== 'INPUT' || (t as HTMLInputElement).type === 'submit') return
  if (e.currentTarget.querySelectorAll('button:not([type="button"])').length > 1) e.preventDefault()
}

function Lock({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus()
  return (
    <fieldset className="form-lock" disabled={pending} aria-busy={pending || undefined}>
      {children}
    </fieldset>
  )
}

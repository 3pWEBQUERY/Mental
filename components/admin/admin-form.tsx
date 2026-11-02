'use client'

import { useState, useTransition, type CSSProperties, type ReactNode } from 'react'
import { askConfirm } from '@/components/confirm'
import { toast } from '@/lib/client/bus'
import type { AdminResult } from '@/lib/admin-result'

type Action = (form: FormData) => Promise<AdminResult>

/**
 * Formular im Admin-Bereich: speichert ohne Neuladen, meldet das Ergebnis als Toast und zeigt Fehler am
 * Formular. Eingaben bleiben bei einem Fehler stehen. Ein neues Element leert das Formular nach dem Speichern
 * (`resetOnSuccess`). Die Seite selbst frischt die Server-Aktion auf (updateTag / refresh).
 */
export function AdminForm({
  action,
  children,
  id,
  className,
  style,
  label,
  resetOnSuccess,
}: {
  action: Action
  children?: ReactNode
  id?: string
  className?: string
  style?: CSSProperties
  label?: string
  resetOnSuccess?: boolean
}) {
  const [error, setError] = useState('')
  const [pending, start] = useTransition()
  return (
    <form
      id={id}
      className={className}
      style={style}
      aria-label={label}
      aria-busy={pending || undefined}
      onSubmit={(e) => {
        e.preventDefault()
        const form = e.currentTarget
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
        const data = new FormData(form, submitter)
        setError('')
        start(async () => {
          let res: AdminResult
          try {
            res = await action(data)
          } catch {
            res = { ok: false, error: 'Das hat nicht geklappt. Bitte noch einmal versuchen.' }
          }
          if (!res.ok) return setError(res.error)
          toast(res.message)
          if (resetOnSuccess) form.reset()
        })
      }}
    >
      {children}
      {error && (
        <p className="error" role="alert" style={{ flexBasis: '100%', margin: 0 }}>
          {error}
        </p>
      )}
    </form>
  )
}

/**
 * Löschen mit ruhiger Rückfrage. Der Knopf steht im Bearbeiten-Formular, gehört aber zum Lösch-Formular
 * `form` (eigenes AdminForm mit der Lösch-Aktion; Formulare lassen sich nicht verschachteln).
 */
export function DeleteButton({ form, message, label = 'Löschen' }: { form: string; message: string; label?: string }) {
  return (
    <button
      type="button"
      className="btn ghost small"
      onClick={async () => {
        if (await askConfirm(message, label)) (document.getElementById(form) as HTMLFormElement | null)?.requestSubmit()
      }}
    >
      {label}
    </button>
  )
}

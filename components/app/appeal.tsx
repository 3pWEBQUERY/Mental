'use client'

import { useState } from 'react'
import { appeal } from '@/app/(app)/actions'
import { m } from '@/messages'

/**
 * Einspruch direkt an der Moderations-Benachrichtigung – im offenen Dialog, ohne zweiten Dialog und ohne Toast
 * (der läge hinter dem Dialog): Rückmeldung steht gleich hier.
 */
export function AppealInline() {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const a = m.appeal
  if (done)
    return (
      <p className="fine" role="status">
        {a.sent}
      </p>
    )
  if (!open)
    return (
      <button type="button" className="linkish" onClick={() => setOpen(true)}>
        {a.open}
      </button>
    )
  return (
    <form
      className="stack appeal"
      style={{ gap: 8 }}
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        setError('')
        const res = await appeal(text).catch(() => ({ ok: false as const, error: m.common.error }))
        setBusy(false)
        if (res.ok) setDone(true)
        else setError(res.error)
      }}
    >
      <label className="field-label" htmlFor="appeal-text">
        {a.label}
      </label>
      <textarea
        id="appeal-text"
        className="input"
        rows={3}
        maxLength={1000}
        value={text}
        placeholder={a.placeholder}
        onChange={(e) => setText(e.target.value)}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={error ? 'appeal-error' : undefined}
        autoFocus
      />
      {error && (
        <p className="error" id="appeal-error" role="alert">
          {error}
        </p>
      )}
      <div>
        <button className="btn small" disabled={busy || text.trim().length < 10}>
          {a.send}
        </button>
      </div>
    </form>
  )
}

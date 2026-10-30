'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { recover } from '@/app/(auth)/actions'
import { m } from '@/messages'

export function RecoverForm() {
  const [username, setUsername] = useState('')
  const [key, setKey] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [words, setWords] = useState<string[] | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const res = await recover({ username, key, password })
    setBusy(false)
    if (!res.ok) return setError(res.error)
    setWords(res.words)
  }

  if (words) {
    return (
      <div className="auth-card stack">
        <h1>{m.auth.newKeyTitle}</h1>
        <p className="notice">{m.auth.recoverDone}</p>
        <p className="lead">{m.register.keyIntro}</p>
        <ol className="key-grid" aria-label={m.auth.recoveryKey}>
          {words.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ol>
        <div className="row-actions">
          <button type="button" className="btn ghost" onClick={() => navigator.clipboard?.writeText(words.join(' '))}>
            {m.register.keyCopy}
          </button>
          <Link className="btn" href="/lichtung">
            {m.register.finish}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-card">
      <h1>{m.auth.recoverTitle}</h1>
      <p className="lead">{m.auth.recoverIntro}</p>
      <form className="stack" onSubmit={submit} noValidate>
        <div>
          <label className="field-label" htmlFor="username">
            {m.auth.username}
          </label>
          <input
            id="username"
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="key">
            {m.auth.recoveryKey}
          </label>
          <textarea
            id="key"
            className="input serif"
            style={{ minHeight: 96 }}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={m.auth.recoveryPlaceholder}
            autoCapitalize="none"
            spellCheck={false}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="password">
            {m.settings.newPassword}
          </label>
          <input
            id="password"
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          <p className="help-text">{m.auth.passwordHint}</p>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="row-actions">
          <button className="btn" disabled={busy || !username || !key || password.length < 10}>
            {m.common.next}
          </button>
          <Link className="btn ghost" href="/anmelden">
            {m.common.back}
          </Link>
        </div>
      </form>
      <p className="notice" style={{ marginTop: 28 }}>
        {m.auth.recoverLost}
      </p>
    </div>
  )
}

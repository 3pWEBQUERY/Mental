'use client'

import { browserSupportsWebAuthn, startAuthentication } from '@simplewebauthn/browser'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type FormEvent } from 'react'
import { login, passkeyLogin, passkeyLoginOptions } from '@/app/(auth)/actions'
import { toast } from '@/lib/client/bus'
import { forgetPrivate } from '@/lib/client/private-storage'
import { m } from '@/messages'

export function LoginForm() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [webauthn, setWebauthn] = useState(false)
  useEffect(() => setWebauthn(browserSupportsWebAuthn()), [])
  // Niemand angemeldet: Entwurf und Aufgedecktes der vorigen Person vom Gerät nehmen.
  useEffect(forgetPrivate, [])

  function done(notice: string | null) {
    if (notice) toast(notice)
    router.replace('/lichtung')
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const res = await login({ username, password })
    setBusy(false)
    if (!res.ok) return setError(res.error)
    done(res.notice)
  }

  async function withPasskey() {
    setBusy(true)
    setError('')
    try {
      const options = await passkeyLoginOptions()
      if (!options) throw new Error(m.common.rateLimited)
      const response = await startAuthentication({ optionsJSON: options })
      const res = await passkeyLogin(response)
      if (!res.ok) throw new Error(res.error)
      done(res.notice)
    } catch (err) {
      setError(err instanceof Error && err.message.length > 12 ? err.message : m.auth.passkeyFailed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-card">
      <h1>
        {m.auth.loginTitleLead} <em>{m.auth.loginTitleEm}</em>
      </h1>
      <p className="lead">{m.auth.usernameHint}</p>
      <form className="stack" onSubmit={submit} noValidate>
        <div>
          <label className="field-label" htmlFor="username">
            {m.auth.username}
          </label>
          <input
            id="username"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'form-error' : undefined}
            name="username"
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username webauthn"
            autoCapitalize="none"
            spellCheck={false}
            required
          />
        </div>
        <div>
          <label className="field-label" htmlFor="password">
            {m.auth.password}
          </label>
          <input
            id="password"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'form-error' : undefined}
            name="password"
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        {error && (
          <p className="error" role="alert" id="form-error">
            {error}
          </p>
        )}
        <div className="row-actions">
          <button className="btn" disabled={busy || !username || !password}>
            {m.auth.login}
          </button>
          {webauthn && (
            <button type="button" className="btn ghost" onClick={withPasskey} disabled={busy}>
              {m.auth.passkey}
            </button>
          )}
        </div>
      </form>
      <div className="stack" style={{ marginTop: 28 }}>
        <Link className="linkish" href="/wiederherstellen">
          {m.auth.forgot}
        </Link>
        <p className="fine">
          {m.auth.noAccount} <Link href="/registrieren">{m.auth.register}</Link>
        </p>
      </div>
    </div>
  )
}

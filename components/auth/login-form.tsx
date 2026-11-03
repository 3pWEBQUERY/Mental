'use client'

import { browserSupportsWebAuthn, startAuthentication } from '@simplewebauthn/browser'
import Link from 'next/link'
import { useEffect, useState, type FormEvent } from 'react'
import { login, passkeyLogin, passkeyLoginOptions } from '@/app/(auth)/actions'
import { carryNotice } from '@/lib/client/notice'
import { solvePow } from '@/lib/client/pow'
import { forgetPrivate } from '@/lib/client/private-storage'
import { m } from '@/messages'

/** Ein Fehler mit eigenem, übersetztem Text – nur solche Meldungen werden angezeigt (nie die englischen des Browsers). */
class Shown extends Error {}

export function LoginForm() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [webauthn, setWebauthn] = useState(false)
  useEffect(() => setWebauthn(browserSupportsWebAuthn()), [])
  // Niemand angemeldet: Entwurf und Aufgedecktes der vorigen Person vom Gerät nehmen.
  useEffect(forgetPrivate, [])

  function done(notice: string | null) {
    // Der Hinweis (z. B. «Löschung abgebrochen») überlebt den Seitenaufbau – die App zeigt ihn nach dem Laden.
    if (notice) carryNotice(notice)
    // Ganzer Seitenaufbau statt Client-Navigation: kein Zustand einer vorherigen Sitzung im Tab.
    window.location.replace('/start')
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    let res = await login({ username, password }).catch(() => ({ ok: false as const, error: m.common.error }))
    // Unter Angriff auf diesen Namen verlangt der Server eine kleine Rechenaufgabe – im Hintergrund lösen, dann erneut.
    if (!res.ok && 'pow' in res && res.pow) {
      setError(res.error)
      const pow = await solvePow()
      res = pow ? await login({ username, password, pow }).catch(() => ({ ok: false as const, error: m.common.error })) : { ok: false as const, error: m.common.error }
    }
    setBusy(false)
    if (!res.ok) return setError(res.error)
    setError('')
    done(res.notice)
  }

  async function withPasskey() {
    setBusy(true)
    setError('')
    try {
      const got = await passkeyLoginOptions()
      if (!got) throw new Shown(m.common.rateLimited)
      const { options, related } = got
      let response
      try {
        response = await startAuthentication({ optionsJSON: options })
      } catch (first) {
        // Kein Passkey für jiaia.app gewählt: vielleicht einer von der früheren Adresse.
        if (!related.length) throw first
        for (const rpId of related) {
          try {
            response = await startAuthentication({ optionsJSON: { ...options, rpId } })
            break
          } catch {}
        }
        if (!response) throw new Shown(m.auth.passkeyLegacyFailed)
      }
      const res = await passkeyLogin(response)
      if (!res.ok) throw new Shown(res.error)
      done(res.notice)
    } catch (err) {
      setError(err instanceof Shown ? err.message : m.auth.passkeyFailed)
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

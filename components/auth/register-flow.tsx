'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { checkPassword, checkUsername, prepareRecoveryKey, register, setInitialDisplayName } from '@/app/(auth)/actions'
import { forgetPrivate } from '@/lib/client/private-storage'
import { solvePow } from '@/lib/client/pow'
import { suggestUsername } from '@/lib/username'
import { m } from '@/messages'
import { usePasskeySetup } from './passkey-setup'

const r = m.register
const STEPS = r.steps.length

function Progress({ step }: { step: number }) {
  return (
    <>
      <div className="progress" aria-hidden="true">
        {r.steps.map((s, i) => (
          <i key={s} className={i <= step ? 'on' : ''} />
        ))}
      </div>
      <div className="eyebrow">
        {r.stepOf(step + 1, STEPS)} · {r.steps[step]}
      </div>
    </>
  )
}

function pickTwo(): [number, number] {
  const a = Math.floor(Math.random() * 12)
  let b = Math.floor(Math.random() * 11)
  if (b >= a) b++
  return a < b ? [a, b] : [b, a]
}

export function RegisterFlow() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [welcome, setWelcome] = useState(0)
  const [rules, setRules] = useState(false)
  const [age, setAge] = useState(false)
  const [username, setUsername] = useState('')
  const [realName, setRealName] = useState(false)
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [key, setKey] = useState<{ words: string[]; sealed: string } | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [confirmIdx] = useState(pickTwo)
  const [answers, setAnswers] = useState(['', ''])
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState('')
  const [busy, setBusy] = useState(false)
  const pow = useRef<Promise<string | null> | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const passkey = usePasskeySetup()

  // Bot-Schutz rechnet unsichtbar im Hintergrund, während die Person liest.
  useEffect(() => {
    pow.current = solvePow()
    // Neues Konto auf diesem Gerät: Entwurf und Aufgedecktes einer vorigen Person entfernen.
    forgetPrivate()
  }, [])
  useEffect(() => {
    heading.current?.focus()
  }, [step, welcome, confirming])
  const placeholderName = useMemo(() => suggestUsername(), [])

  function go(next: number) {
    setError('')
    setStep(next)
  }

  async function submitUsername(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    const res = await checkUsername(username)
    setBusy(false)
    if (!res.ok) return setError(res.error)
    if (res.realName && !realName) {
      setRealName(true)
      return
    }
    go(3)
  }

  async function submitPassword(e: FormEvent) {
    e.preventDefault()
    if (password.length < 10) return setError(r.passwordShort)
    if (password !== password2) return setError(r.passwordMismatch)
    setBusy(true)
    const res = await checkPassword(password)
    if (!res.ok) {
      setBusy(false)
      return setError(res.error)
    }
    setKey(await prepareRecoveryKey())
    setBusy(false)
    go(4)
  }

  async function submitKey(e: FormEvent) {
    e.preventDefault()
    if (!key) return
    const ok = confirmIdx.every((idx, i) => answers[i]!.trim().toLowerCase() === key.words[idx])
    if (!ok) return setError(r.keyWrong)
    setBusy(true)
    setError('')
    // Kein Fehler, sondern ein Zwischenstand – als Status, nicht als Alarm.
    setPending(r.botCheck)
    const payload = await (pow.current ?? solvePow())
    setPending('')
    if (!payload) {
      setBusy(false)
      return setError(r.botFailed)
    }
    const res = await register({ username, password, sealedKey: key.sealed, ageConfirmed: true, rulesAccepted: true, pow: payload })
    setBusy(false)
    if (!res.ok) {
      setError(res.error)
      if (res.field === 'username') setStep(2)
      pow.current = solvePow()
      return
    }
    go(passkey.supported ? 5 : 6)
  }

  async function submitName(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    const res = await setInitialDisplayName(displayName)
    setBusy(false)
    // Die genaue Meldung zeigen (z. B. «keine Telefonnummer im Anzeigenamen»), nicht nur «Fehler».
    if (!res.ok) return setError(res.error)
    router.replace('/lichtung')
  }

  const errorEl = error ? (
    <p className="error" role="alert" id="form-error">
      {error}
    </p>
  ) : pending ? (
    <p className="fine" role="status">
      {pending}
    </p>
  ) : null
  // Fehler mit dem Feld verknüpfen: Screenreader lesen ihn beim Feld vor, das Feld gilt als ungültig.
  const invalid = error ? ({ 'aria-invalid': true, 'aria-describedby': 'form-error' } as const) : {}

  return (
    <div className="auth-card">
      <Progress step={step} />

      {step === 0 && (
        <div className="stack">
          <h1 ref={heading} tabIndex={-1}>
            {r.welcome[welcome]!.title}
          </h1>
          {welcome < 2 ? (
            <p className="lead">{r.welcome[welcome]!.body}</p>
          ) : (
            <>
              <ol className="rules-list">
                {r.rules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ol>
              <label className="check">
                <input type="checkbox" checked={rules} onChange={(e) => setRules(e.target.checked)} />
                {r.acceptRules}
              </label>
            </>
          )}
          <div className="row-actions">
            {welcome > 0 && (
              <button type="button" className="btn ghost" onClick={() => setWelcome(welcome - 1)}>
                {m.common.back}
              </button>
            )}
            <button type="button" className="btn" disabled={welcome === 2 && !rules} onClick={() => (welcome < 2 ? setWelcome(welcome + 1) : go(1))}>
              {m.common.next}
            </button>
          </div>
          <p className="fine">
            {m.auth.haveAccount} <Link href="/anmelden">{m.auth.login}</Link>
          </p>
        </div>
      )}

      {step === 1 && (
        <div className="stack">
          <h1 ref={heading} tabIndex={-1}>
            {r.ageTitle} <em>{r.ageTitleEm}</em>
          </h1>
          <label className="check">
            <input type="checkbox" checked={age} onChange={(e) => setAge(e.target.checked)} />
            <span>
              {r.age}
              <span className="help-text" style={{ display: 'block' }}>
                {r.ageHint}
              </span>
            </span>
          </label>
          <div className="row-actions">
            <button type="button" className="btn ghost" onClick={() => go(0)}>
              {m.common.back}
            </button>
            <button type="button" className="btn" disabled={!age} onClick={() => go(2)}>
              {m.common.next}
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <form className="stack" onSubmit={submitUsername} noValidate>
          <h1 ref={heading} tabIndex={-1}>
            {r.usernameTitle}
          </h1>
          <p className="lead">{r.usernameIntro}</p>
          <div>
            <label className="field-label" htmlFor="username">
              {m.auth.username}
            </label>
            <div className="input-row">
              <input
                id="username"
                {...invalid}
                className="input"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))
                  setRealName(false)
                  setError('')
                }}
                placeholder={placeholderName}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={24}
                required
              />
              <button type="button" className="btn ghost" onClick={() => setUsername(suggestUsername())}>
                {r.suggest}
              </button>
            </div>
            <p className="help-text">{r.usernameRules}</p>
          </div>
          {realName && (
            <p className="notice warn" role="status">
              {r.usernameRealName}
            </p>
          )}
          {errorEl}
          <div className="row-actions">
            <button type="button" className="btn ghost" onClick={() => go(1)}>
              {m.common.back}
            </button>
            <button className="btn" disabled={busy || username.length < 3}>
              {realName ? r.continueAnyway : m.common.next}
            </button>
          </div>
        </form>
      )}

      {step === 3 && (
        <form className="stack" onSubmit={submitPassword} noValidate>
          <h1 ref={heading} tabIndex={-1}>
            {r.passwordTitle}
          </h1>
          <p className="lead">{r.passwordIntro}</p>
          <input type="text" name="username" value={username} autoComplete="username" readOnly hidden />
          <div>
            <label className="field-label" htmlFor="pw">
              {m.auth.password}
            </label>
            <input
              id="pw"
              {...invalid}
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={10}
              required
            />
          </div>
          <div>
            <label className="field-label" htmlFor="pw2">
              {r.passwordRepeat}
            </label>
            <input
              id="pw2"
              {...invalid}
              className="input"
              type="password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
          {errorEl}
          <div className="row-actions">
            <button type="button" className="btn ghost" onClick={() => go(2)}>
              {m.common.back}
            </button>
            <button className="btn" disabled={busy || password.length < 10}>
              {busy ? m.common.loading : m.common.next}
            </button>
          </div>
        </form>
      )}

      {step === 4 && key && !confirming && (
        <div className="stack">
          <h1 ref={heading} tabIndex={-1}>
            {r.keyTitle}
          </h1>
          <p className="lead">{r.keyIntro}</p>
          <ol className="key-grid" aria-label={m.auth.recoveryKey}>
            {key.words.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ol>
          <div className="row-actions">
            <button
              type="button"
              className="btn ghost"
              onClick={async () => {
                await navigator.clipboard?.writeText(key.words.join(' ')).catch(() => {})
                setError(r.keyCopied)
              }}
            >
              {r.keyCopy}
            </button>
            <button type="button" className="btn" onClick={() => (setError(''), setConfirming(true))}>
              {r.keyWritten}
            </button>
          </div>
          {error && (
            <p className="fine" role="status">
              {error}
            </p>
          )}
        </div>
      )}

      {step === 4 && key && confirming && (
        <form className="stack" onSubmit={submitKey} noValidate>
          <h1 ref={heading} tabIndex={-1}>
            {r.keyCheckTitle}
          </h1>
          <p className="lead">{r.keyConfirm(confirmIdx[0] + 1, confirmIdx[1] + 1)}</p>
          {confirmIdx.map((idx, i) => (
            <div key={idx}>
              <label className="field-label" htmlFor={`w${i}`}>
                {r.keyWord(idx + 1)}
              </label>
              <input
                id={`w${i}`}
                {...invalid}
                className="input serif"
                value={answers[i]}
                onChange={(e) => setAnswers((a) => a.map((v, j) => (j === i ? e.target.value : v)))}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
              />
            </div>
          ))}
          {errorEl}
          <div className="row-actions">
            <button type="button" className="btn ghost" onClick={() => (setError(''), setConfirming(false))}>
              {r.keyShowAgain}
            </button>
            <button className="btn" disabled={busy || answers.some((a) => !a.trim())}>
              {busy ? m.common.loading : m.auth.register}
            </button>
          </div>
        </form>
      )}

      {step === 5 && (
        <div className="stack">
          <h1 ref={heading} tabIndex={-1}>
            {r.passkeyTitle}
          </h1>
          <p className="lead">{r.passkeyIntro}</p>
          {passkey.error && <p className="error">{passkey.error}</p>}
          <div className="row-actions">
            <button
              type="button"
              className="btn"
              disabled={passkey.busy}
              onClick={async () => {
                if ((await passkey.setup()) === true) go(6)
              }}
            >
              {r.passkeySetup}
            </button>
            <button type="button" className="btn ghost" onClick={() => go(6)}>
              {r.passkeySkip}
            </button>
          </div>
        </div>
      )}

      {step === 6 && (
        <form className="stack" onSubmit={submitName} noValidate>
          <h1 ref={heading} tabIndex={-1}>
            {r.displayTitle}
          </h1>
          <p className="lead">{r.displayIntro}</p>
          <div>
            <label className="field-label" htmlFor="dn">
              {m.settings.displayName}
            </label>
            <input
              id="dn"
              {...invalid}
              className="input serif"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={r.displayPlaceholder}
              maxLength={32}
              autoComplete="off"
            />
          </div>
          {errorEl}
          <div className="row-actions">
            <button className="btn" disabled={busy || displayName.trim().length < 2}>
              {r.finish}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

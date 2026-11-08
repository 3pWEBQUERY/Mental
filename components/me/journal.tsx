'use client'

import { useEffect, useState, type FormEvent } from 'react'
import {
  addJournalEntry,
  deleteJournalEntry,
  listJournal,
  resetJournal,
  setupJournal,
  type JournalCipher,
} from '@/app/(app)/(raum)/ich/actions'
import { emit, toast } from '@/lib/client/bus'
import { b64, CHECK_TEXT, cryptoAvailable, decryptText, deriveMaster, encryptText, random, unb64 } from '@/lib/client/journal-crypto'
import { LIMITS } from '@/lib/constants'
import { formatDate } from '@/lib/time'
import { m } from '@/messages'
import { askConfirm } from '../confirm'
import { attempt } from '@/lib/client/attempt'

type Entry = JournalCipher & { text: string | null }

export function Journal({ state }: { state: { salt: string; check: { iv: string; ciphertext: string; salt: string } } | null }) {
  const [setup, setSetup] = useState(state)
  const [master, setMaster] = useState<CryptoKey | null>(null)
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [entries, setEntries] = useState<Entry[]>([])
  const [draft, setDraft] = useState('')
  const [supported, setSupported] = useState(true)
  const [resetPw, setResetPw] = useState('')
  const j = m.journal

  useEffect(() => setSupported(cryptoAvailable()), [])

  // Wieder abschliessen, sobald das Tagebuch nicht mehr zu sehen ist: beim Seitenwechsel in der App (React Activity
  // hält die Seite sonst samt Schlüssel im Speicher – «Zurück» zeigte es ohne PIN), beim Verlassen der Seite
  // (Back-Forward-Cache) und nach 5 Minuten in einem anderen Tab.
  useEffect(() => {
    const lock = () => {
      setMaster(null)
      setEntries([])
      setDraft('')
    }
    let timer: ReturnType<typeof setTimeout> | undefined
    const onVisibility = () => {
      clearTimeout(timer)
      if (document.visibilityState === 'hidden') timer = setTimeout(lock, 5 * 60_000)
    }
    window.addEventListener('pagehide', lock)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('pagehide', lock)
      document.removeEventListener('visibilitychange', onVisibility)
      lock()
    }
  }, [])

  async function create(e: FormEvent) {
    e.preventDefault()
    if (pin.length < 6) return setError(j.pinShort)
    if (pin !== pin2) return setError(j.pinMismatch)
    setBusy(true)
    let ok = false
    let key: CryptoKey | null = null
    const salt = random(16)
    let check: Awaited<ReturnType<typeof encryptText>> | null = null
    try {
      key = await deriveMaster(pin, salt)
      check = await encryptText(key, CHECK_TEXT)
      ok = await setupJournal({ salt: b64(salt), check })
    } catch {
      ok = false
    }
    setBusy(false)
    if (!ok || !key || !check) return setError(m.common.error)
    setSetup({ salt: b64(salt), check })
    setMaster(key)
    setPin('')
    setPin2('')
  }

  async function unlock(e: FormEvent) {
    e.preventDefault()
    if (!setup) return
    setBusy(true)
    setError('')
    try {
      const key = await deriveMaster(pin, unb64(setup.salt))
      if ((await decryptText(key, setup.check)) !== CHECK_TEXT) throw new Error()
      const list = await listJournal()
      const decoded = await Promise.all(
        list.map(async (en) => ({ ...en, text: await decryptText(key, en).catch(() => null) })),
      )
      setEntries(decoded)
      setMaster(key)
      setPin('')
    } catch {
      setError(j.wrongPin)
    } finally {
      setBusy(false)
    }
  }

  async function add(e: FormEvent) {
    e.preventDefault()
    if (!master || !draft.trim()) return
    setBusy(true)
    const saved = await encryptText(master, draft.trim())
      .then((sealed) => addJournalEntry(sealed))
      .catch(() => null)
    setBusy(false)
    if (!saved) return toast(m.common.error)
    setEntries((cur) => [{ ...saved, text: draft.trim() }, ...cur])
    setDraft('')
  }

  if (!supported) return <p className="notice">{j.unsupported}</p>

  return (
    <section aria-labelledby="journal-title">
      <div className="row-actions" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <h2 id="journal-title" className="section-label" style={{ margin: 0 }}>
          {j.title}
        </h2>
        {master && (
          <button
            type="button"
            className="btn ghost small"
            onClick={() => {
              setMaster(null)
              setEntries([])
            }}
          >
            {j.lock}
          </button>
        )}
      </div>
      <p className="fine" style={{ marginBottom: 16, maxWidth: '60ch' }}>
        <span className="lock">● </span>
        {j.intro}
      </p>

      {!setup && (
        <form className="card stack" onSubmit={create}>
          <h3 style={{ fontFamily: 'var(--serif)', fontWeight: 400, fontSize: 'calc(26px * var(--fz))' }}>{j.setupTitle}</h3>
          <p className="notice warn">{j.setupHint}</p>
          <div>
            <label className="field-label" htmlFor="pin">
              {j.pin}
            </label>
            <input id="pin" className="input" type="password" inputMode="text" autoComplete="new-password" value={pin} onChange={(e) => setPin(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="pin2">
              {j.pinRepeat}
            </label>
            <input id="pin2" className="input" type="password" autoComplete="new-password" value={pin2} onChange={(e) => setPin2(e.target.value)} />
          </div>
          {error && <p className="error">{error}</p>}
          <div>
            <button className="btn" disabled={busy}>
              {busy ? m.common.loading : j.setup}
            </button>
          </div>
        </form>
      )}

      {setup && !master && (
        <form className="card stack" onSubmit={unlock}>
          <h3 style={{ fontFamily: 'var(--serif)', fontWeight: 400, fontSize: 'calc(26px * var(--fz))' }}>{j.unlockTitle}</h3>
          <div>
            <label className="field-label" htmlFor="pin-unlock">
              {j.pin}
            </label>
            <input id="pin-unlock" className="input" type="password" autoComplete="current-password" value={pin} onChange={(e) => setPin(e.target.value)} />
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div>
            <button className="btn" disabled={busy || !pin}>
              {busy ? m.common.loading : j.unlock}
            </button>
          </div>
          <details>
            <summary className="linkish">{j.forgot}</summary>
            <div className="stack" style={{ gap: 10, marginTop: 10 }}>
              <p className="fine">{j.forgotHint}</p>
              <label className="field-label" htmlFor="journal-reset-pw">
                {j.forgotPassword}
              </label>
              <input
                id="journal-reset-pw"
                className="input"
                type="password"
                autoComplete="current-password"
                value={resetPw}
                onChange={(e) => setResetPw(e.target.value)}
              />
              <div>
                <button
                  type="button"
                  className="btn ghost danger small"
                  disabled={busy || !resetPw}
                  onClick={async () => {
                    if (!(await askConfirm(j.forgotConfirm, j.forgotReset))) return
                    setBusy(true)
                    const res = await attempt(() => resetJournal(resetPw))
                    setBusy(false)
                    if (!res) return
                    setResetPw('')
                    setPin('')
                    setError('')
                    setSetup(null)
                    toast(j.forgotDone)
                  }}
                >
                  {j.forgotReset}
                </button>
              </div>
            </div>
          </details>
        </form>
      )}

      {master && (
        <>
          <form className="stack" onSubmit={add}>
            <label className="sr-only" htmlFor="journal-new">
              {j.placeholder}
            </label>
            <textarea
              id="journal-new"
              className="input serif"
              style={{ minHeight: 140 }}
              maxLength={LIMITS.journalMax}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={j.placeholder}
            />
            <div className="row-actions" style={{ justifyContent: 'space-between' }}>
              <span className="count">
                {draft.length} / {LIMITS.journalMax}
              </span>
              <button className="btn" disabled={busy || !draft.trim()}>
                {j.add}
              </button>
            </div>
          </form>
          <ul style={{ marginTop: 18 }}>
            {entries.length === 0 && <li className="fine">{j.empty}</li>}
            {entries.map((en) => (
              <li key={en.id} className="journal-entry">
                <small>{formatDate(en.createdAt, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</small>
                <p>{en.text ?? '…'}</p>
                <div className="row-actions">
                  {en.text && en.text.length >= LIMITS.postMin && (
                    <button
                      type="button"
                      className="linkish"
                      title={j.shareHint}
                      onClick={() => emit('compose', { text: en.text!.slice(0, LIMITS.postMax) })}
                    >
                      {j.share}
                    </button>
                  )}
                  <button
                    type="button"
                    className="linkish"
                    onClick={async () => {
                      if (!(await askConfirm(j.deleteConfirm, m.common.delete))) return
                      if (await attempt(() => deleteJournalEntry(en.id))) setEntries((cur) => cur.filter((x) => x.id !== en.id))
                    }}
                  >
                    {m.common.delete}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

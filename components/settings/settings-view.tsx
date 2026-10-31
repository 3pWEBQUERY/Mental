'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition, type FormEvent, type ReactNode } from 'react'
import { logout } from '@/app/(auth)/actions'
import { setCirclePref } from '@/app/(app)/actions'
import {
  changePassword,
  deleteAccount,
  endSession,
  exportStatus,
  listPasskeys,
  regenerateRecoveryKey,
  removePasskey,
  removePushSubscription,
  requestExport,
  savePushSubscription,
  unblock,
  updateIdentity,
  updateQuietHours,
  updateSettings,
  type ExportState,
  type PasskeyItem,
  type SessionItem,
} from '@/app/(app)/einstellungen/actions'
import type { Settings } from '@/db/schema'
import { toast } from '@/lib/client/bus'
import { applyLocalPrefs, readLocalPrefs } from '@/lib/prefs-script'
import { formatDate } from '@/lib/time'
import { m } from '@/messages'
import { usePasskeySetup } from '../auth/passkey-setup'
import { askConfirm } from '../confirm'
import { PanicButton } from '../panic'
import { circleColor } from '../app/circles'
import { attempt } from '@/lib/client/attempt'
import { RadioGroup } from '../radio-group'

const s = m.settings

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="section" aria-label={title}>
      <h2>{title}</h2>
      <div>{children}</div>
    </section>
  )
}

function Segment<T extends string>({ value, options, onChange, label }: { value: T; options: Record<T, string>; onChange: (v: T) => void; label: string }) {
  return (
    <RadioGroup fluid className="segment" label={label} value={value} onChange={onChange} options={(Object.keys(options) as T[]).map((k) => ({ value: k, label: options[k] }))} />
  )
}

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <i />
      <span>
        {label}
        {hint && <small>{hint}</small>}
      </span>
    </label>
  )
}

function urlB64ToUint8(base64: string) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

export type SettingsData = {
  displayName: string
  defaultVisibility: 'anonymous' | 'pseudonym'
  settings: Settings
  circles: { slug: string; name: string; color: string; state: 'follow' | 'mute' | null }[]
  sessions: SessionItem[]
  blocked: { ref: string; since: string; kind: 'member' | 'post' }[]
  quiet: { from: number; to: number }
  vapidKey: string | null
}

export function SettingsView({ data }: { data: SettingsData }) {
  const router = useRouter()
  const [pending, start] = useTransition()

  /* Identität */
  const [displayName, setDisplayName] = useState(data.displayName)
  const [visibility, setVisibility] = useState(data.defaultVisibility)

  /* Darstellung & Raum */
  const [prefs, setPrefs] = useState<Settings>(data.settings)
  useEffect(() => {
    const local = readLocalPrefs()
    if (local.theme) setPrefs((p) => ({ ...p, theme: local.theme }))
  }, [])
  function setPref(patch: Partial<Settings>) {
    const next = { ...prefs, ...patch }
    setPrefs(next)
    if ('theme' in patch || 'fontSize' in patch || 'motion' in patch || 'discreet' in patch) {
      applyLocalPrefs({ theme: next.theme, fontSize: next.fontSize, motion: next.motion, discreet: next.discreet })
    }
    start(async () => {
      const r = await updateSettings(patch)
      if (!r.ok) toast(r.error)
      else if ('motion' in patch || 'breathSound' in patch || 'hidePresence' in patch || 'collapseWarnings' in patch) router.refresh()
    })
  }

  /* Kreise */
  const [circles, setCircles] = useState(data.circles)

  /* Sicherheit */
  const [pw, setPw] = useState({ current: '', next: '' })
  const [pwMsg, setPwMsg] = useState('')
  const [keyPw, setKeyPw] = useState('')
  const [pkReauth, setPkReauth] = useState(false)
  const [pkPw, setPkPw] = useState('')
  const [newKey, setNewKey] = useState<string[] | null>(null)
  const [keys, setKeys] = useState<PasskeyItem[] | null>(null)
  const [sessions, setSessions] = useState(data.sessions)
  const passkey = usePasskeySetup()
  useEffect(() => {
    void listPasskeys().then(setKeys)
  }, [])

  /* Push */
  const [push, setPush] = useState<'unknown' | 'on' | 'off' | 'unsupported' | 'denied'>('unknown')
  const [quiet, setQuiet] = useState(data.quiet)
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !data.vapidKey) return setPush('unsupported')
    if (Notification.permission === 'denied') return setPush('denied')
    void navigator.serviceWorker.ready.then(async (reg) => setPush((await reg.pushManager.getSubscription()) ? 'on' : 'off'))
  }, [data.vapidKey])

  async function togglePush(on: boolean) {
    const reg = await navigator.serviceWorker.ready
    if (on) {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') return setPush('denied')
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8(data.vapidKey!) })
      const r = await savePushSubscription(sub.toJSON(), quiet)
      setPush(r.ok ? 'on' : 'off')
    } else {
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await removePushSubscription(sub.endpoint)
        await sub.unsubscribe()
      }
      setPush('off')
    }
  }

  /* Blockiert */
  const [blocked, setBlocked] = useState(data.blocked)

  /* Daten */
  const [exp, setExp] = useState<ExportState>({ status: 'none' })
  useEffect(() => {
    void exportStatus().then(setExp)
  }, [])
  useEffect(() => {
    if (exp.status !== 'pending') return
    const t = setInterval(() => void exportStatus().then(setExp), 4000)
    return () => clearInterval(t)
  }, [exp.status])
  const [delPw, setDelPw] = useState('')
  const [delErr, setDelErr] = useState('')

  const hours = Array.from({ length: 24 }, (_, i) => i)

  return (
    <div>
      <Section title={s.sections.identity}>
        <form
          className="sub"
          onSubmit={(e: FormEvent) => {
            e.preventDefault()
            start(async () => {
              const r = await updateIdentity({ displayName, defaultVisibility: visibility })
              toast(r.ok ? m.common.saved : r.error)
              if (r.ok) router.refresh()
            })
          }}
        >
          <div>
            <label className="field-label" htmlFor="dn">
              {s.displayName}
            </label>
            <input id="dn" className="input serif" value={displayName} maxLength={32} onChange={(e) => setDisplayName(e.target.value)} />
            <p className="help-text">{s.displayNameHint}</p>
          </div>
          <div>
            <span className="field-label">{s.defaultVisibility}</span>
            <Segment value={visibility} options={s.visibility} onChange={setVisibility} label={s.defaultVisibility} />
          </div>
          <div>
            <button className="btn" disabled={pending || displayName.trim().length < 2}>
              {m.common.save}
            </button>
          </div>
        </form>
      </Section>

      <Section title={s.sections.security}>
        <form
          className="sub"
          onSubmit={(e) => {
            e.preventDefault()
            start(async () => {
              const r = await changePassword(pw)
              setPwMsg(r.ok ? s.passwordChanged : r.error)
              if (r.ok) {
                setPw({ current: '', next: '' })
                setSessions((cur) => cur.filter((x) => x.current))
              }
            })
          }}
        >
          <h3 className="field-label">{s.password}</h3>
          <input type="text" autoComplete="username" hidden readOnly />
          {/* Sichtbare Beschriftungen statt nur Platzhalter – und die Mindestlänge steht da, nicht nur im grauen Knopf. */}
          <label className="field-label" htmlFor="pw-current">
            {s.currentPassword}
          </label>
          <input id="pw-current" className="input" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
          <label className="field-label" htmlFor="pw-next">
            {s.newPassword}
          </label>
          <input
            id="pw-next"
            className="input"
            type="password"
            autoComplete="new-password"
            aria-describedby="pw-next-hint"
            value={pw.next}
            onChange={(e) => setPw({ ...pw, next: e.target.value })}
          />
          <p className="help-text" id="pw-next-hint">
            {s.newPasswordHint}
          </p>
          {pwMsg && <p className="fine" role="status">{pwMsg}</p>}
          <div>
            <button className="btn ghost" disabled={pending || !pw.current || pw.next.length < 10}>
              {s.password}
            </button>
          </div>
        </form>

        <div className="sub">
          <span className="field-label">{s.passkeys}</span>
          {keys?.length === 0 && <p className="fine">{s.passkeyNone}</p>}
          {keys?.map((k) => (
            <div key={k.id} className="kv">
              <span>
                {k.label}
                <small>{s.sessionSince(formatDate(k.createdAt))}</small>
              </span>
              <button
                type="button"
                className="btn ghost small"
                onClick={async () => {
                  if (!(await askConfirm(k.label, s.passkeyRemove))) return
                  if (!(await attempt(() => removePasskey(k.id)))) return
                  setKeys((cur) => cur?.filter((x) => x.id !== k.id) ?? null)
                }}
              >
                {s.passkeyRemove}
              </button>
            </div>
          ))}
          {passkey.supported && (
            <form
              className="stack"
              style={{ gap: 10 }}
              onSubmit={async (e) => {
                e.preventDefault()
                const r = await passkey.setup(pkReauth ? pkPw : undefined)
                if (r === 'reauth') return setPkReauth(true)
                if (r) {
                  setPkReauth(false)
                  setPkPw('')
                  toast(s.passkeyAdded)
                  setKeys(await listPasskeys())
                }
              }}
            >
              {pkReauth && (
                <>
                  <p className="fine">{s.passkeyReauth}</p>
                  <input
                    className="input"
                    type="password"
                    placeholder={s.currentPassword}
                    aria-label={s.currentPassword}
                    value={pkPw}
                    onChange={(e) => setPkPw(e.target.value)}
                    autoComplete="current-password"
                    autoFocus
                  />
                </>
              )}
              <div>
                <button type="submit" className="btn ghost" disabled={passkey.busy || (pkReauth && !pkPw)}>
                  {s.passkeyAdd}
                </button>
              </div>
              {passkey.error && <p className="error">{passkey.error}</p>}
            </form>
          )}
        </div>

        <form
          className="sub"
          onSubmit={(e) => {
            e.preventDefault()
            start(async () => {
              const r = await regenerateRecoveryKey(keyPw)
              if (!r.ok) return toast(r.error)
              setNewKey(r.words)
              setKeyPw('')
            })
          }}
        >
          <span className="field-label">{s.recovery}</span>
          <p className="help-text" style={{ marginTop: 0 }}>
            {s.recoveryHint}
          </p>
          {newKey ? (
            <>
              <p className="notice warn">{m.register.keyIntro}</p>
              <ol className="key-grid">
                {newKey.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ol>
            </>
          ) : (
            <div className="input-row">
              <input className="input" type="password" placeholder={s.currentPassword} aria-label={s.currentPassword} value={keyPw} onChange={(e) => setKeyPw(e.target.value)} autoComplete="current-password" />
              <button className="btn ghost" disabled={pending || !keyPw}>
                {s.recoveryCreate}
              </button>
            </div>
          )}
        </form>

        <div className="sub">
          <span className="field-label">{s.sessions}</span>
          {sessions.map((x) => (
            <div key={x.id} className="kv">
              <span>
                {x.device} {x.current && <b style={{ fontWeight: 500 }}>· {s.sessionCurrent}</b>}
                <small>
                  {s.sessionSince(formatDate(x.createdAt))} · {s.lastSeen(formatDate(x.lastSeenAt, { day: 'numeric', month: 'long' }))}
                </small>
              </span>
              {!x.current && (
                <button
                  type="button"
                  className="btn ghost small"
                  onClick={async () => {
                    if (!(await attempt(() => endSession(x.id)))) return
                    setSessions((cur) => cur.filter((y) => y.id !== x.id))
                  }}
                >
                  {s.sessionEnd}
                </button>
              )}
            </div>
          ))}
          {sessions.length > 1 && (
            <div>
              <button
                type="button"
                className="btn ghost small"
                onClick={async () => {
                  if (!(await attempt(() => endSession('others')))) return
                  setSessions((cur) => cur.filter((y) => y.current))
                }}
              >
                {s.sessionsEndOthers}
              </button>
            </div>
          )}
        </div>
      </Section>

      <Section title={s.sections.feed}>
        <div className="sub">
          <span className="field-label">{s.muteCircles}</span>
          <p className="help-text" style={{ marginTop: 0 }}>
            {s.muteCirclesHint}
          </p>
          {circles.map((c) => (
            <div key={c.slug} className="kv">
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <i className="dot" style={{ background: circleColor(c.color) }} />
                {c.name}
              </span>
              <Segment
                value={c.state ?? 'none'}
                options={{ none: s.circleNormal, follow: m.circles.follow, mute: m.circles.mute }}
                label={c.name}
                onChange={async (val) => {
                  const state = val === 'none' ? null : val
                  const before = c.state
                  setCircles((cur) => cur.map((x) => (x.slug === c.slug ? { ...x, state } : x)))
                  // Optimistisch – schlägt es fehl, springt die Wahl zurück.
                  if (!(await attempt(() => setCirclePref(c.slug, state)))) setCircles((cur) => cur.map((x) => (x.slug === c.slug ? { ...x, state: before } : x)))
                }}
              />
            </div>
          ))}
        </div>
        <div className="sub">
          <Toggle checked={prefs.collapseWarnings ?? true} onChange={(v) => setPref({ collapseWarnings: v })} label={s.collapseWarnings} />
          <Toggle checked={prefs.hidePresence ?? false} onChange={(v) => setPref({ hidePresence: v })} label={s.hidePresence} />
        </div>
      </Section>

      <Section title={s.sections.room}>
        <div className="sub">
          <span className="field-label">{s.motion}</span>
          <Segment value={prefs.motion ?? 'on'} options={s.motionOptions} onChange={(v) => setPref({ motion: v })} label={s.motion} />
          <Toggle checked={prefs.breathSound ?? false} onChange={(v) => setPref({ breathSound: v })} label={s.breathSound} />
        </div>
      </Section>

      <Section title={s.sections.notifications}>
        <div className="sub">
          {push === 'unsupported' ? (
            <p className="notice">{s.pushUnsupported}</p>
          ) : push === 'denied' ? (
            <p className="notice">{s.pushDenied}</p>
          ) : (
            <Toggle checked={push === 'on'} onChange={(v) => void togglePush(v)} label={s.push} hint={s.pushHint} />
          )}
          <div>
            <span className="field-label">{s.quiet}</span>
            <div className="row-actions">
              <label className="fine" htmlFor="qf">
                {s.quietFrom}
              </label>
              <select id="qf" className="input" style={{ width: 'auto' }} value={quiet.from} onChange={(e) => setQuiet({ ...quiet, from: Number(e.target.value) })}>
                {hours.map((h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, '0')}:00
                  </option>
                ))}
              </select>
              <label className="fine" htmlFor="qt">
                {s.quietTo}
              </label>
              <select id="qt" className="input" style={{ width: 'auto' }} value={quiet.to} onChange={(e) => setQuiet({ ...quiet, to: Number(e.target.value) })}>
                {hours.map((h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, '0')}:00
                  </option>
                ))}
              </select>
              <button type="button" className="btn ghost small" onClick={async () => toast((await updateQuietHours(quiet.from, quiet.to)).ok ? m.common.saved : m.common.error)}>
                {m.common.save}
              </button>
            </div>
          </div>
        </div>
      </Section>

      <Section title={s.sections.display}>
        <div className="sub">
          <span className="field-label">{s.theme}</span>
          <Segment value={prefs.theme ?? 'light'} options={s.themes} onChange={(v) => setPref({ theme: v })} label={s.theme} />
          <span className="field-label">{s.fontSize}</span>
          <Segment value={prefs.fontSize ?? 'normal'} options={s.fontSizes} onChange={(v) => setPref({ fontSize: v })} label={s.fontSize} />
          <Toggle checked={prefs.discreet ?? false} onChange={(v) => setPref({ discreet: v })} label={s.discreet} hint={s.discreetHint} />
        </div>
      </Section>

      <Section title={s.sections.blocked}>
        <div className="sub">
          {blocked.length === 0 && <p className="fine">{s.blockedEmpty}</p>}
          {blocked.map((b) => (
            <div key={b.ref} className="kv">
              <span>
                {b.kind === 'post' ? s.hiddenPost : s.blockedMember(blocked.filter((x) => x.kind === 'member').indexOf(b) + 1)}
                <small>{s.sessionSince(formatDate(b.since))}</small>
              </span>
              <button
                type="button"
                className="btn ghost small"
                onClick={async () => {
                  if (await attempt(() => unblock(b.ref))) setBlocked((cur) => cur.filter((x) => x.ref !== b.ref))
                }}
              >
                {b.kind === 'post' ? s.unhidePost : s.unblock}
              </button>
            </div>
          ))}
        </div>
      </Section>

      <Section title={s.sections.data}>
        <div className="sub">
          <span className="field-label">{s.export}</span>
          <p className="help-text" style={{ marginTop: 0 }}>
            {s.exportHint}
          </p>
          {exp.status === 'pending' && <p className="notice">{s.exportPending}</p>}
          {exp.status === 'failed' && <p className="error">{s.exportFailed}</p>}
          <div className="row-actions">
            {exp.status === 'ready' && exp.id && (
              <a className="btn" href={`/api/export/${exp.id}`}>
                {s.exportReady}
              </a>
            )}
            {exp.status !== 'pending' && (
              <button
                type="button"
                className="btn ghost"
                onClick={async () => {
                  const r = await requestExport()
                  if (!r.ok) return toast(r.error)
                  setExp({ status: r.status, id: r.id })
                }}
              >
                {s.exportCreate}
              </button>
            )}
          </div>
        </div>
        <form
          className="sub"
          onSubmit={async (e) => {
            e.preventDefault()
            if (!(await askConfirm(s.deleteHint, s.deleteButton))) return
            const r = await deleteAccount(delPw)
            if (!r.ok) return setDelErr(r.error)
            window.location.replace('/')
          }}
        >
          <span className="field-label">{s.deleteAccount}</span>
          <p className="help-text" style={{ marginTop: 0 }}>
            {s.deleteHint}
          </p>
          <div className="input-row">
            <input className="input" type="password" placeholder={s.deleteConfirm} aria-label={s.deleteConfirm} value={delPw} onChange={(e) => setDelPw(e.target.value)} autoComplete="current-password" />
            <button className="btn ghost danger" disabled={!delPw}>
              {s.deleteButton}
            </button>
          </div>
          {delErr && <p className="error">{delErr}</p>}
        </form>
      </Section>

      <section className="section" aria-label={s.logout}>
        <h2>{s.logout}</h2>
        <div className="sub">
          <p className="help-text" style={{ marginTop: 0 }}>
            {s.panicHint}
          </p>
          <div className="row-actions">
            <form action={logout}>
              <button className="btn ghost">{s.logout}</button>
            </form>
            <PanicButton />
          </div>
          <p className="fine">
            <a href="/regeln">{m.landing.rules}</a> · <a href="/datenschutz">{m.landing.privacy}</a> ·{' '}
            <a href="/impressum">{m.landing.imprint}</a>
          </p>
        </div>
      </section>
    </div>
  )
}

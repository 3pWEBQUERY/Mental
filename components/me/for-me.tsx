'use client'

import { useEffect, useState, useTransition, type ReactNode } from 'react'
import { deleteLetter, saveSafetyPlan, writeLetter, type LetterView } from '@/app/(app)/(raum)/ich/actions'
import type { SafetyPlan } from '@/db/schema'
import { attempt } from '@/lib/client/attempt'
import { toast } from '@/lib/client/bus'
import { PLAN_KEY } from '@/lib/client/private-storage'
import { formatDate } from '@/lib/time'
import { m } from '@/messages'
import { askConfirm } from '../confirm'

import { PLAN_FIELDS } from './plan-fields'

export { PLAN_FIELDS }
const EMPTY: SafetyPlan = { signs: '', self: '', distract: '', people: '', pros: '', safe: '' }

/** Der Plan zum Lesen – im Hilfe-Dialog und unter «Ich». Leere Felder fallen weg. */
/**
 * Telefonnummern im Notfallplan zum Antippen: In einer Krise ist eine Nummer abzutippen eine Hürde.
 * Erkannt werden Schweizer Nummern (+41 …, 0…) und die Kurznummern 112, 117, 118, 143, 144, 145, 147.
 */
const PHONE = /(?<![\d+])(\+\d[\d /()-]{6,18}\d|0\d[\d /()-]{6,14}\d|1(?:4[3-57]|1[278]))(?!\d)/g

export function withPhoneLinks(text: string): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  for (const match of text.matchAll(PHONE)) {
    const i = match.index ?? 0
    if (i > last) out.push(text.slice(last, i))
    const number = match[0]
    out.push(
      <a key={i} href={`tel:${number.replace(/[^\d+]/g, '')}`}>
        {number}
      </a>,
    )
    last = i + number.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export function SafetyPlanView({ plan }: { plan: SafetyPlan }) {
  const f = m.plan.fields
  return (
    <ol className="plan-view">
      {PLAN_FIELDS.filter((k) => plan[k]).map((k) => (
        <li key={k}>
          <h3>{f[k].label}</h3>
          <p>{withPhoneLinks(plan[k])}</p>
        </li>
      ))}
    </ol>
  )
}

/** Offline-Kopie lesen/schreiben – localStorage kann fehlen (privates Fenster) oder voll sein. */
function storeOffline(plan: SafetyPlan | null) {
  try {
    if (plan) localStorage.setItem(PLAN_KEY, JSON.stringify({ plan, at: new Date().toISOString() }))
    else localStorage.removeItem(PLAN_KEY)
    return true
  } catch {
    return false
  }
}
function hasOffline() {
  try {
    return localStorage.getItem(PLAN_KEY) !== null
  } catch {
    return false
  }
}

/** Nur den Plan drucken: alles andere blendet @media print über die Klasse am <html> aus. */
function printPlan() {
  const root = document.documentElement
  root.classList.add('print-plan')
  const done = () => {
    root.classList.remove('print-plan')
    window.removeEventListener('afterprint', done)
  }
  window.addEventListener('afterprint', done)
  window.print()
}

export function SafetyPlanEditor({ initial }: { initial: SafetyPlan | null }) {
  const [plan, setPlan] = useState<SafetyPlan>(initial ?? EMPTY)
  // Zuletzt gespeicherter Stand – «Abbrechen» kehrt dorthin zurück.
  const [saved, setSaved] = useState<SafetyPlan | null>(initial)
  const [editing, setEditing] = useState(!initial)
  const [offline, setOffline] = useState(false)
  const [pending, start] = useTransition()
  const p = m.plan
  const filled = PLAN_FIELDS.some((k) => plan[k].trim())

  // Eine vorhandene Offline-Kopie mit dem Stand vom Server auffrischen (auf einem anderen Gerät geändert?).
  useEffect(() => {
    if (!hasOffline()) return
    setOffline(true)
    if (initial) storeOffline(initial)
  }, [initial])

  return (
    <section aria-labelledby="plan-title" className="for-me-block">
      <div className="row-actions" style={{ justifyContent: 'space-between' }}>
        <h2 id="plan-title" className="section-label" style={{ margin: 0 }}>
          {p.title}
        </h2>
        {!editing && (
          <div className="row-actions">
            {filled && (
              <button type="button" className="btn ghost small" onClick={printPlan}>
                {p.print}
              </button>
            )}
            <button type="button" className="btn ghost small" onClick={() => setEditing(true)}>
              {p.edit}
            </button>
          </div>
        )}
      </div>
      <p className="fine" style={{ margin: '6px 0 16px', maxWidth: '60ch' }}>
        {p.intro}
      </p>
      {editing ? (
        <form
          className="stack"
          style={{ gap: 16 }}
          onSubmit={(e) => {
            e.preventDefault()
            start(async () => {
              if (!(await attempt(() => saveSafetyPlan(plan)))) return
              setSaved(plan)
              // Lässt sich die Offline-Kopie nicht schreiben (Speicher voll), sagen wir es – sonst wäre sie still veraltet.
              if (offline && !storeOffline(plan)) toast(m.common.error)
              toast(p.saved)
              setEditing(false)
            })
          }}
        >
          {PLAN_FIELDS.map((k, i) => (
            <label key={k} className="plan-field">
              <span>
                <b>
                  {i + 1}. {p.fields[k].label}
                </b>
                <small>{p.fields[k].hint}</small>
              </span>
              <textarea className="input" rows={3} maxLength={1500} value={plan[k]} onChange={(e) => setPlan({ ...plan, [k]: e.target.value })} />
            </label>
          ))}
          <div className="row-actions">
            <button className="btn" disabled={pending}>
              {p.save}
            </button>
            {saved && (
              <button
                type="button"
                className="btn ghost"
                disabled={pending}
                onClick={() => {
                  setPlan(saved)
                  setEditing(false)
                }}
              >
                {m.common.cancel}
              </button>
            )}
          </div>
        </form>
      ) : filled ? (
        <div className="plan-print">
          <p className="plan-print-head">{p.title}</p>
          <SafetyPlanView plan={plan} />
          <p className="fine plan-print-note">{p.printNote}</p>
        </div>
      ) : null}
      {!editing && filled && (
        <label className="check" style={{ marginTop: 18 }}>
          <input
            type="checkbox"
            checked={offline}
            onChange={(e) => {
              const on = e.target.checked
              if (!storeOffline(on ? plan : null)) return toast(m.common.error)
              setOffline(on)
              toast(on ? p.offlineOn : p.offlineOff)
            }}
          />
          <span>
            {p.offline}
            <small className="fine" style={{ display: 'block' }}>
              {p.offlineHint}
            </small>
          </span>
        </label>
      )}
    </section>
  )
}

export function Letters({ initial }: { initial: LetterView[] }) {
  const [list, setList] = useState(initial)
  const [text, setText] = useState('')
  const [pending, start] = useTransition()
  const l = m.letters
  return (
    <section aria-labelledby="letters-title" className="for-me-block">
      <h2 id="letters-title" className="section-label">
        {l.title}
      </h2>
      <p className="fine" style={{ margin: '6px 0 16px', maxWidth: '60ch' }}>
        {l.intro}
      </p>
      <form
        className="stack"
        style={{ gap: 10 }}
        onSubmit={(e) => {
          e.preventDefault()
          start(async () => {
            const res = await attempt(() => writeLetter(text))
            if (!res) return
            setList((cur) => [res.letter, ...cur])
            setText('')
            toast(l.saved)
          })
        }}
      >
        <label className="sr-only" htmlFor="letter-text">
          {l.title}
        </label>
        <textarea id="letter-text" className="input letter-input" rows={5} maxLength={2000} placeholder={l.placeholder} value={text} onChange={(e) => setText(e.target.value)} />
        <div>
          <button className="btn" disabled={pending || !text.trim()}>
            {l.write}
          </button>
        </div>
      </form>
      {list.length > 0 && (
        <ul className="letters">
          {list.map((x) => (
            <li key={x.id}>
              <p>{x.body}</p>
              <div className="row-actions" style={{ justifyContent: 'space-between' }}>
                <span className="fine">
                  {formatDate(x.createdAt)} · {x.shownAt ? l.shown(formatDate(x.shownAt)) : l.waiting}
                </span>
                <button
                  type="button"
                  className="linkish"
                  onClick={async () => {
                    if (!(await askConfirm(l.deleteConfirm, m.common.delete))) return
                    if (await attempt(() => deleteLetter(x.id))) setList((cur) => cur.filter((y) => y.id !== x.id))
                  }}
                >
                  {m.common.delete}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { logBreath, saveCheckin } from '@/app/(app)/actions'
import { emit, on, toast } from '@/lib/client/bus'
import { BREATH, LIMITS, MOOD_HEAVY } from '@/lib/constants'
import { formatDate } from '@/lib/time'
import { m } from '@/messages'
import { panic } from '../panic'
import { Dialog } from '../dialog'
import { RadioGroup } from '../radio-group'
import { useViewer } from '../viewer'
import { inlineGrounding } from './grounding'
import type { OrbApi } from './orb'
import { attempt } from '@/lib/client/attempt'

function OrbFallback() {
  return (
    <div className="orb" aria-hidden="true">
      <svg className="orb-fallback" viewBox="0 0 240 240">
        <circle cx="120" cy="120" r="119.5" fill="none" strokeWidth="1" />
      </svg>
    </div>
  )
}

// Three.js landet nur im Client-Bundle und blockiert den ersten Paint nicht.
const Orb = dynamic(() => import('./orb'), { ssr: false, loading: OrbFallback })

type Phase = 'inhale' | 'hold' | 'exhale'
type Mode = 'breath' | 'ground'
const CYCLE = BREATH.inhale + BREATH.hold + BREATH.exhale
const TOTAL = CYCLE * BREATH.cycles

export function Stage({ dateLabel, greeting }: { dateLabel: string; greeting: string }) {
  const viewer = useViewer()
  const [mood, setMood] = useState<number | null>(viewer.lastMood)
  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNote] = useState('')
  const [breathing, setBreathing] = useState(false)
  const [phase, setPhase] = useState<Phase>('inhale')
  const [left, setLeft] = useState<number | null>(null)
  const [proHint, setProHint] = useState(false)
  const [letter, setLetter] = useState<{ body: string; createdAt: string } | null>(null)
  const [webgl, setWebgl] = useState(viewer.motion !== 'off')
  // Zwei Folien im Raum: Atmen (Kugel) und 5-4-3-2-1 (die Kugel wird zur Ziffer).
  const [mode, setMode] = useState<Mode>('breath')
  const [gstep, setGstep] = useState(0)
  const swipe = useRef<{ x: number; y: number; id: number } | null>(null)
  const api = useRef<OrbApi | null>(null)
  const fallbackTimer = useRef<number>(0)
  const started = useRef(0)

  useEffect(() => on('pulse', () => api.current?.pulse()), [])
  useEffect(() => on('breathe', () => startBreath()))

  async function pick(i: number) {
    setMood(i)
    api.current?.setMood(i)
    api.current?.pulse()
    emit('checkin-mood', i)
    const res = await attempt(() => saveCheckin({ mood: i }))
    if (res?.proHint) setProHint(true)
    if (res?.letter) setLetter(res.letter)
  }

  async function saveNote() {
    if (mood === null || !note.trim()) return
    const res = await attempt(() => saveCheckin({ mood, note }))
    if (res) {
      toast(m.stage.noteSaved)
      setNote('')
      setNoteOpen(false)
    }
  }

  function finish(done: boolean) {
    cancelAnimationFrame(fallbackTimer.current)
    setBreathing(false)
    setLeft(null)
    const seconds = Math.round((performance.now() - started.current) / 1000)
    if (seconds >= 10) void logBreath(Math.min(seconds, TOTAL))
    if (done) toast(m.stage.breathDone)
  }

  function startBreath() {
    if (breathing) return
    if (mode === 'ground') {
      setMode('breath')
      api.current?.ground(null, -1)
    }
    setBreathing(true)
    setPhase('inhale')
    started.current = performance.now()
    const still = document.documentElement.dataset.motion || matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: still ? 'auto' : 'smooth' })
    const tick = (p: Phase, l: number) => {
      setPhase(p)
      setLeft(l)
    }
    if (api.current) {
      api.current.breathe(tick, finish)
      return
    }
    // Ohne Animation führt nur der Text.
    const loop = () => {
      const t0 = (performance.now() - started.current) / 1000
      if (t0 >= TOTAL) return finish(true)
      const t = t0 % CYCLE
      tick(t < BREATH.inhale ? 'inhale' : t < BREATH.inhale + BREATH.hold ? 'hold' : 'exhale', Math.ceil(TOTAL - t0))
      fallbackTimer.current = requestAnimationFrame(loop)
    }
    loop()
  }

  function stopBreath() {
    if (api.current) api.current.stopBreath()
    else finish(false)
  }

  const g = m.grounding
  const gdone = gstep >= g.steps.length
  const gcur = g.steps[gstep]

  function switchMode(next: Mode) {
    if (next === mode) return
    if (breathing) stopBreath()
    setMode(next)
    if (next === 'ground') {
      setGstep(0)
      api.current?.ground(g.steps[0]!.n, 1)
    } else api.current?.ground(null, -1)
  }

  function nextStep() {
    const n = gstep + 1
    setGstep(n)
    // Nach der Eins wird die Ziffer wieder zur Kugel – «Du bist hier».
    api.current?.ground(n < g.steps.length ? g.steps[n]!.n : null, 1)
  }

  // Aus «Sofort Hilfe» heraus: Auf der Lichtung führt der Raum die Übung selbst.
  const openGround = useRef(() => {})
  openGround.current = () => {
    const still = document.documentElement.dataset.motion || matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: still ? 'auto' : 'smooth' })
    if (mode === 'ground') {
      setGstep(0)
      api.current?.ground(g.steps[0]!.n, 1)
    } else switchMode('ground')
  }
  useEffect(() => {
    inlineGrounding.current = () => openGround.current()
    return () => {
      inlineGrounding.current = null
    }
  }, [])

  const s = m.stage
  return (
    <section
      className={`stage${breathing ? ' breathing' : ''}`}
      aria-label={s.label}
      data-mode={mode}
      onClick={(e) => {
        if (breathing && !(e.target as HTMLElement).closest('button, a, textarea')) stopBreath()
      }}
      // Wischen zwischen den Folien (vor allem auf dem Handy): nach links zu 5-4-3-2-1, nach rechts zum Atmen.
      onPointerDown={(e) => {
        if (breathing || (e.target as HTMLElement).closest('button, a, textarea, input')) return
        swipe.current = { x: e.clientX, y: e.clientY, id: e.pointerId }
      }}
      onPointerUp={(e) => {
        const st = swipe.current
        swipe.current = null
        if (!st || st.id !== e.pointerId) return
        const dx = e.clientX - st.x
        const dy = e.clientY - st.y
        if (Math.abs(dx) > 60 && Math.abs(dx) > 1.6 * Math.abs(dy)) switchMode(dx < 0 ? 'ground' : 'breath')
      }}
      onPointerCancel={() => (swipe.current = null)}
    >
      {webgl ? (
        <Orb
          motion={viewer.motion}
          sound={viewer.breathSound}
          initialMood={viewer.lastMood}
          onApi={(a) => (api.current = a)}
          onUnavailable={() => setWebgl(false)}
        />
      ) : (
        <OrbFallback />
      )}
      {!webgl && mode === 'ground' && !gdone && (
        <div className="ground-numeral" aria-hidden="true" key={gstep}>
          {gcur!.n}
        </div>
      )}
      <div className="stage-top">
        <Link href="/lichtung" className="brand">
          {m.brand}
        </Link>
        <span className="date">{dateLabel}</span>
        <button type="button" className="hide-btn" onClick={panic}>
          {s.hide}
        </button>
      </div>
      {/* Angesagt wird nur die Phase (Einatmen/Halten/Ausatmen) – nicht jede Sekunde. */}
      <div className="breath-label">
        <b aria-live="polite">{s[phase]}</b>
        <span aria-hidden="true">{left === null ? s.breathStart : s.breathMeta(left)}</span>
      </div>
      <div className="checkin">
        <div className="stage-switch-wrap" onPointerEnter={() => api.current?.prepareGround()} onFocus={() => api.current?.prepareGround()}>
          <RadioGroup
            fluid
            className="segment stage-switch"
            label={s.modes.label}
            value={mode}
            onChange={switchMode}
            options={[
              { value: 'breath' as Mode, label: s.modes.breath },
              { value: 'ground' as Mode, label: s.modes.ground },
            ]}
          />
        </div>
        <div className="stage-slides" data-mode={mode}>
          <div className="slide slide-breath" inert={mode !== 'breath'} aria-hidden={mode !== 'breath'}>
            <div className="eyebrow">{greeting}</div>
            <h2>
              {s.question} <em>{s.questionEm}</em>
            </h2>
            <RadioGroup
              fluid
              className="moods"
              itemClassName="mood"
              label={s.moodGroup}
              value={mood}
              onChange={pick}
              options={m.moods.labels.map((label, i) => ({ value: i, label }))}
            />
            <p className="mood-note" aria-live="polite">
              {mood === null ? (
                s.pick
              ) : (
                <>
                  {m.moods.notes[mood]}{' '}
                  {mood === MOOD_HEAVY && (
                    <button type="button" className="link" onClick={() => emit('help')}>
                      {m.moods.needSomeone}
                    </button>
                  )}
                </>
              )}
            </p>
            {proHint && (
              <div className="care" role="status" style={{ maxWidth: '40ch', marginBottom: 10 }}>
                <b>{s.proHint.title}</b>
                <br />
                {s.proHint.body}
                <div className="actions">
                  <button type="button" className="btn small" onClick={() => emit('help')}>
                    {s.proHint.help}
                  </button>
                  <button type="button" className="btn ghost small" onClick={() => setProHint(false)}>
                    {s.proHint.ok}
                  </button>
                </div>
              </div>
            )}
            {mood !== null && (
              <div className="note-row">
                {noteOpen ? (
                  <>
                    <label className="sr-only" htmlFor="checkin-note">
                      {s.noteToggle}
                    </label>
                    <textarea
                      id="checkin-note"
                      value={note}
                      maxLength={LIMITS.noteMax}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder={s.notePlaceholder}
                    />
                    <div className="row">
                      <span className="count">
                        {note.length} / {LIMITS.noteMax}
                      </span>
                      <button type="button" className="btn small" onClick={saveNote} disabled={!note.trim()}>
                        {m.common.save}
                      </button>
                    </div>
                  </>
                ) : (
                  <button type="button" className="linkish" onClick={() => setNoteOpen(true)}>
                    {s.noteToggle}
                  </button>
                )}
              </div>
            )}
            <div className="stage-actions">
              <button type="button" className="btn" onClick={breathing ? stopBreath : startBreath}>
                {breathing ? s.stop : s.breathe}
              </button>
              <button type="button" className="btn ghost" onClick={() => emit('compose')}>
                {s.share}
              </button>
            </div>
          </div>
          <div className="slide slide-ground" inert={mode !== 'ground'} aria-hidden={mode !== 'ground'}>
            {/* Neu pro Schritt: Der Inhalt gleitet von rechts herein, im Takt der Punkte oben. */}
            <div className="ground-step" key={gstep}>
              <div className="eyebrow">{gdone ? g.title : g.progress(gstep + 1, g.steps.length)}</div>
              <h2 className="ground-text" aria-live="polite">
                {gdone ? g.doneLead : gcur!.text}
              </h2>
              <p className="mood-note">{gdone ? g.doneNote : gcur!.hint}</p>
            </div>
            <ol className="grounding-dots" aria-label={g.progress(Math.min(gstep + 1, g.steps.length), g.steps.length)}>
              {g.steps.map((st, i) => (
                <li key={st.n} className={i < gstep ? 'on' : i === gstep ? 'on now' : undefined} />
              ))}
            </ol>
            <div className="stage-actions">
              {gdone ? (
                <button type="button" className="btn" onClick={() => switchMode('breath')}>
                  {g.close}
                </button>
              ) : (
                <>
                  <button type="button" className="btn" onClick={nextStep}>
                    {g.next}
                  </button>
                  <button type="button" className="btn ghost" onClick={() => switchMode('breath')}>
                    {g.back}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      <Dialog open={letter !== null} onClose={() => setLetter(null)} title={m.letters.title} className="letter-dialog">
        {letter && (
          <div className="stack" style={{ gap: 14 }}>
            <p className="fine">{m.letters.from(formatDate(letter.createdAt))}</p>
            <p className="letter-body">{letter.body}</p>
            <div>
              <button type="button" className="btn" data-autofocus onClick={() => setLetter(null)}>
                {m.letters.close}
              </button>
            </div>
          </div>
        )}
      </Dialog>
    </section>
  )
}

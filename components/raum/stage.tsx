'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { logBreath, saveCheckin } from '@/app/(app)/actions'
import { emit, on, toast } from '@/lib/client/bus'
import { BREATH, LIMITS, MOOD_HEAVY } from '@/lib/constants'
import { m } from '@/messages'
import { panic } from '../panic'
import { useViewer } from '../viewer'
import type { OrbApi } from './orb'

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
  const [webgl, setWebgl] = useState(viewer.motion !== 'off')
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
    const res = await saveCheckin({ mood: i })
    if (res.ok && res.proHint) setProHint(true)
  }

  async function saveNote() {
    if (mood === null || !note.trim()) return
    const res = await saveCheckin({ mood, note })
    if (res.ok) {
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

  const s = m.stage
  return (
    <section
      className={`stage${breathing ? ' breathing' : ''}`}
      aria-label={s.label}
      onClick={(e) => {
        if (breathing && !(e.target as HTMLElement).closest('button, a, textarea')) stopBreath()
      }}
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
      <div className="stage-top">
        <Link href="/lichtung" className="brand">
          {m.brand}
        </Link>
        <span className="date">{dateLabel}</span>
        <button type="button" className="hide-btn" onClick={panic}>
          {s.hide}
        </button>
      </div>
      <div className="breath-label" aria-live="polite">
        <b>{s[phase]}</b>
        <span>{left === null ? s.breathStart : s.breathMeta(left)}</span>
      </div>
      <div className="checkin">
        <div className="eyebrow">{greeting}</div>
        <h1>
          {s.question} <em>{s.questionEm}</em>
        </h1>
        <div className="moods" role="group" aria-label={s.moodGroup}>
          {m.moods.labels.map((label, i) => (
            <button key={label} type="button" className="mood" aria-pressed={mood === i} onClick={() => pick(i)}>
              {label}
            </button>
          ))}
        </div>
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
    </section>
  )
}

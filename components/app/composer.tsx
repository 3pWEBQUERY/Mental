'use client'

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { createPost, updatePost } from '@/app/(app)/actions'
import { emit, on, pulse, toast } from '@/lib/client/bus'
import { IMAGE_TYPES, LIMITS, NEEDS, type Need } from '@/lib/constants'
import { detectCrisis } from '@/lib/crisis'
import type { PublicPost } from '@/lib/dto'
import { detectPii, type PiiMatch } from '@/lib/pii'
import { m } from '@/messages'
import { Dialog } from '../dialog'
import { RadioGroup } from '../radio-group'
import { useViewer } from '../viewer'
import { AcuteDialog, CareNote } from './care'

const DRAFT_KEY = 'lichtung-draft'
type Draft = { text: string; need: Need; circle: string; cw: boolean }

function readDraft(): Draft | null {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null') as Draft | null
    return d && d.text ? d : null
  } catch {
    return null
  }
}

/** Spiegel hinter dem Textfeld: markiert persönliche Daten direkt im Text. */
function Highlight({ text, matches }: { text: string; matches: PiiMatch[] }) {
  const parts: React.ReactNode[] = []
  let i = 0
  for (const mt of matches) {
    parts.push(text.slice(i, mt.start))
    parts.push(<mark key={mt.start}>{text.slice(mt.start, mt.end)}</mark>)
    i = mt.end
  }
  parts.push(`${text.slice(i)}\n`)
  return (
    <div className="hl" aria-hidden="true">
      {parts}
    </div>
  )
}

type Upload = { mediaId: string; preview: string } | { uploading: true; preview: string } | null

/**
 * HEIC/HEIF wandelt der Browser selbst in JPEG um (iOS Safari kann HEIC dekodieren).
 * So erreichen den Server nur Formate, die der Worker zuverlässig neu kodieren kann.
 */
async function normalizeImage(file: File): Promise<File> {
  if (file.type !== 'image/heic' && file.type !== 'image/heif') return file
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    canvas.getContext('2d')!.drawImage(img, 0, 0)
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.9))
    if (!blob) throw new Error()
    return new File([blob], 'bild.jpg', { type: 'image/jpeg' })
  } catch {
    throw new Error(m.composer.heicUnsupported)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function Composer() {
  const viewer = useViewer()
  const [open, setOpen] = useState(false)
  const [edit, setEdit] = useState<PublicPost | null>(null)
  const [text, setText] = useState('')
  const [need, setNeed] = useState<Need>('listen')
  const [circle, setCircle] = useState(viewer.circles[0]?.slug ?? '')
  const [mood, setMood] = useState(viewer.lastMood ?? 2)
  const [letGo, setLetGo] = useState<0 | 1 | 7 | 30>(0)
  const [anonymous, setAnonymous] = useState(viewer.defaultVisibility === 'anonymous')
  const [cw, setCw] = useState(false)
  const [upload, setUpload] = useState<Upload>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [restored, setRestored] = useState(false)
  const [acute, setAcute] = useState(false)
  const area = useRef<HTMLTextAreaElement>(null)
  const hl = useRef<HTMLDivElement>(null)

  useEffect(() => on('checkin-mood', (i) => setMood(i)), [])
  useEffect(
    () =>
      on('compose', (detail) => {
        setError('')
        setRestored(false)
        if (detail?.edit) {
          const p = detail.edit
          setEdit(p)
          setText(p.body)
          setNeed(p.need)
          setCircle(p.circle.slug)
          setCw(p.contentWarning)
        } else {
          setEdit(null)
          const draft = readDraft()
          if (detail?.text) setText(detail.text)
          else if (draft) {
            setText(draft.text)
            setNeed(draft.need)
            setCircle(draft.circle)
            setCw(draft.cw)
            setRestored(true)
          }
          if (detail?.circle) setCircle(detail.circle)
        }
        // Fokus setzt der Dialog nach showModal() auf das Textfeld (data-autofocus).
        setOpen(true)
      }),
    [],
  )

  // Entwürfe bleiben nur im Browser, nie auf dem Server – bis «Teilen».
  useEffect(() => {
    if (!open || edit) return
    try {
      if (text.trim()) localStorage.setItem(DRAFT_KEY, JSON.stringify({ text, need, circle, cw } satisfies Draft))
      else localStorage.removeItem(DRAFT_KEY)
    } catch {}
  }, [open, edit, text, need, circle, cw])

  const pii = useMemo(() => detectPii(text), [text])
  const crisis = useMemo(() => detectCrisis(text, viewer.crisisTerms), [text, viewer.crisisTerms])
  const len = text.trim().length

  async function pickFile(picked: File | undefined) {
    if (!picked) return
    setError('')
    if (!(IMAGE_TYPES as readonly string[]).includes(picked.type)) return setError(m.composer.imageType)
    if (picked.size > LIMITS.imageMaxBytes) return setError(m.composer.imageTooLarge)
    let file: File
    try {
      file = await normalizeImage(picked)
    } catch (e) {
      return setError((e as Error).message)
    }
    const preview = URL.createObjectURL(file)
    setUpload({ uploading: true, preview })
    try {
      const res = await fetch('/api/uploads', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: file.type, size: file.size }),
      })
      const data = (await res.json()) as { mediaId?: string; url?: string; error?: string }
      if (!res.ok || !data.url || !data.mediaId) throw new Error(data.error ?? m.common.error)
      const put = await fetch(data.url, { method: 'PUT', body: file, headers: { 'content-type': file.type } })
      if (!put.ok) throw new Error(m.common.error)
      setUpload({ mediaId: data.mediaId, preview })
    } catch (e) {
      URL.revokeObjectURL(preview)
      setUpload(null)
      setError(e instanceof Error ? e.message : m.common.error)
    }
  }

  function reset() {
    setText('')
    setCw(false)
    setLetGo(0)
    if (upload) URL.revokeObjectURL(upload.preview)
    setUpload(null)
    setEdit(null)
    try {
      localStorage.removeItem(DRAFT_KEY)
    } catch {}
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (len < LIMITS.postMin || busy || (upload && 'uploading' in upload)) return
    setBusy(true)
    setError('')
    if (edit) {
      const res = await updatePost({ id: edit.id, body: text, need, circle, contentWarning: cw }).catch(() => ({ ok: false as const, error: m.common.error }))
      setBusy(false)
      if (!res.ok) return setError(res.error)
      emit('post-updated', res.post)
      toast(m.composer.updated)
      reset()
      setOpen(false)
      return
    }
    // Wirft die Server Action (Netz, Deploy), darf der Dialog nicht eingefroren bleiben.
    const res = await createPost({
      body: text,
      need,
      circle,
      mood,
      visibility: anonymous ? 'anonymous' : 'pseudonym',
      contentWarning: cw,
      mediaId: upload && 'mediaId' in upload ? upload.mediaId : null,
      letGoDays: letGo,
    }).catch(() => ({ ok: false as const, error: m.common.error }))
    setBusy(false)
    if (!res.ok) return setError(res.error)
    emit('post-created', res.post)
    reset()
    setOpen(false)
    pulse()
    if (res.acute) setAcute(true)
    else toast(m.composer.shared)
  }

  const c = m.composer
  return (
    <>
      <Dialog open={open} onClose={() => setOpen(false)} title={edit ? c.editTitle : c.title} className="dlg-large">
        <form className="composer" onSubmit={submit} noValidate>
          {restored && <p className="fine" style={{ marginBottom: 6 }}>{c.draftRestored}</p>}
          <div className="field">
            <div ref={hl}>
              <Highlight text={text} matches={pii} />
            </div>
            <label className="sr-only" htmlFor="composer-text">
              {c.title}
            </label>
            <textarea
              id="composer-text"
              data-autofocus
              ref={area}
              value={text}
              maxLength={LIMITS.postMax}
              placeholder={c.placeholder}
              onChange={(e) => setText(e.target.value)}
              onScroll={(e) => {
                const h = hl.current?.firstElementChild as HTMLElement | null
                if (h) h.scrollTop = e.currentTarget.scrollTop
              }}
            />
          </div>
          {pii.length > 0 && (
            <p className="pii" role="status">
              {c.pii}{' '}
              {pii.map((p, i) => (
                <span key={p.start}>
                  {i > 0 && ', '}
                  <b>{p.text}</b> ({m.pii[p.kind]})
                </span>
              ))}
            </p>
          )}
          {crisis !== 'none' && <CareNote />}
          <div className="opts">
            <div>
              <h3>{c.need}</h3>
              <RadioGroup className="opt-row" itemClassName="opt" label={c.need} value={need} onChange={setNeed} options={NEEDS.map((n) => ({ value: n, label: m.needs[n] }))} />
            </div>
            <div>
              <h3>{c.circle}</h3>
              <RadioGroup
                className="opt-row"
                itemClassName="opt"
                label={c.circle}
                value={circle}
                onChange={setCircle}
                options={viewer.circles.map((ci) => ({ value: ci.slug, label: ci.name }))}
              />
            </div>
            {!edit && (
              <div>
                <h3>{c.mood}</h3>
                <RadioGroup
                  className="opt-row"
                  itemClassName="opt"
                  label={c.mood}
                  value={mood}
                  onChange={setMood}
                  options={m.moods.labels.map((label, i) => ({
                    value: i,
                    label: (
                      <>
                        <i className="dot" style={{ background: `var(--mood-${i})` }} />
                        {label}
                      </>
                    ),
                  }))}
                />
              </div>
            )}
            {!edit && (
              <label className="switch">
                <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
                <i />
                <span>
                  {c.anonymous}
                  <small>{anonymous ? c.anonymousOn : c.anonymousHint(viewer.displayName)}</small>
                </span>
              </label>
            )}
            {!edit && (
              <div>
                <h3>{c.letGo}</h3>
                <RadioGroup
                  className="opt-row"
                  itemClassName="opt"
                  label={c.letGo}
                  value={letGo}
                  onChange={setLetGo}
                  options={([0, 1, 7, 30] as const).map((d) => ({ value: d, label: c.letGoOptions[d] }))}
                />
                {letGo > 0 && <p className="fine" style={{ marginTop: 6 }}>{c.letGoHint}</p>}
              </div>
            )}
            <label className="switch">
              <input type="checkbox" checked={cw} onChange={(e) => setCw(e.target.checked)} />
              <i />
              <span>
                {c.contentWarning}
                <small>{c.contentWarningHint}</small>
              </span>
            </label>
            {!edit && (
              <div className="attach">
                {upload ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="thumb" src={upload.preview} alt="" />
                    <span className="fine">{'uploading' in upload ? c.imageUploading : ''}</span>
                    <button type="button" className="opt" onClick={() => (URL.revokeObjectURL(upload.preview), setUpload(null))}>
                      {c.imageRemove}
                    </button>
                  </>
                ) : (
                  <>
                    <input
                      id="composer-image"
                      type="file"
                      accept={IMAGE_TYPES.join(',')}
                      onChange={(e) => {
                        void pickFile(e.target.files?.[0])
                        e.target.value = ''
                      }}
                    />
                    <label className="opt" htmlFor="composer-image">
                      {c.image}
                    </label>
                  </>
                )}
                <span className="fine" style={{ flexBasis: '100%' }}>
                  {c.imageHint}
                </span>
              </div>
            )}
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="dlg-foot">
            <span className="count">{len ? c.chars(text.length, LIMITS.postMax) : c.count}</span>
            <button className="btn" type="submit" disabled={len < LIMITS.postMin || busy || Boolean(upload && 'uploading' in upload)}>
              {edit ? c.update : c.submit}
            </button>
          </div>
        </form>
      </Dialog>
      <AcuteDialog open={acute} onClose={() => setAcute(false)} />
    </>
  )
}

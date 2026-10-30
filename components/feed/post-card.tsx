'use client'

import { startTransition, useEffect, useId, useOptimistic, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import {
  blockAuthor,
  createReply,
  deleteReply,
  deletePost,
  hideReply,
  markHelpful,
  setClosed,
  toggleBookmark,
  toggleSupport,
} from '@/app/(app)/actions'
import { emit, pulse, toast } from '@/lib/client/bus'
import { LIMITS, NO_ADVICE_NEEDS, SUPPORT_KINDS, type SupportKind } from '@/lib/constants'
import { detectCrisis } from '@/lib/crisis'
import { detectDerogation } from '@/lib/derogation'
import type { PublicPost, PublicReply } from '@/lib/dto'
import { detectPii } from '@/lib/pii'
import { relativeTime } from '@/lib/time'
import { m } from '@/messages'
import { AcuteDialog, CareNote } from '../app/care'
import { askConfirm } from '../confirm'
import { Glyph } from '../ui'
import { useViewer } from '../viewer'
import { PostImage } from './post-image'
import type { ReportTarget } from './report-dialog'

const REVEALED_KEY = 'lichtung-revealed'
function wasRevealed(id: string) {
  try {
    return (JSON.parse(localStorage.getItem(REVEALED_KEY) ?? '[]') as string[]).includes(id)
  } catch {
    return false
  }
}
function rememberReveal(id: string) {
  try {
    const list = JSON.parse(localStorage.getItem(REVEALED_KEY) ?? '[]') as string[]
    localStorage.setItem(REVEALED_KEY, JSON.stringify([...list.slice(-200), id]))
  } catch {}
}

function Menu({ items, label }: { items: { label: string; onSelect: () => void; danger?: boolean }[]; label: string }) {
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const id = useId()
  useEffect(() => {
    if (!open) return
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== 'Escape') return
      if (e instanceof MouseEvent && wrap.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])
  if (!items.length) return null
  return (
    <div className="menu-wrap" ref={wrap}>
      <button type="button" className="dots" aria-label={label} aria-haspopup="menu" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        ⋯
      </button>
      {open && (
        <div className="menu" role="menu" id={id}>
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              className={it.danger ? 'danger' : undefined}
              onClick={() => {
                setOpen(false)
                it.onSelect()
              }}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function PostCard({
  post,
  onChange,
  onRemove,
  onReport,
  onOpen,
  defaultOpen = false,
}: {
  post: PublicPost
  onChange: (p: PublicPost) => void
  onRemove: (id: string) => void
  onReport: (t: ReportTarget) => void
  /** Öffnet den Gedanken gross im Dialog – per Klick auf Text oder Bild. */
  onOpen?: () => void
  defaultOpen?: boolean
}) {
  const viewer = useViewer()
  const [open, setOpen] = useState(defaultOpen)
  const [revealed, setRevealed] = useState(!post.contentWarning || post.isMine)
  const [reply, setReply] = useState('')
  const [derogationAck, setDerogationAck] = useState(false)
  const [busy, setBusy] = useState(false)
  const [acute, setAcute] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (post.contentWarning && !viewer.collapseWarnings && wasRevealed(post.id)) setRevealed(true)
  }, [post.contentWarning, post.id, viewer.collapseWarnings])

  // Zuspruch und Antworten erscheinen sofort – der Server bestätigt im Hintergrund.
  const [mySupport, toggleOptimistic] = useOptimistic(post.mySupport, (cur: SupportKind[], k: SupportKind) =>
    cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k],
  )
  const [replies, addReplyOptimistic] = useOptimistic(post.replies, (cur: PublicReply[], r: PublicReply) => [...cur, r])

  const crisis = detectCrisis(reply, viewer.crisisTerms) !== 'none'
  const derogation = detectDerogation(reply)
  const pii = detectPii(reply)
  const visibleReplies = replies.filter((r) => !r.hiddenByAuthor || post.isMine || r.isMine)
  const rc = replies.filter((r) => !r.deleted && !r.isAuthor).length

  function support(k: SupportKind) {
    startTransition(async () => {
      toggleOptimistic(k)
      const res = await toggleSupport(post.id, k)
      if (!res.ok) return toast(res.error)
      onChange({ ...post, mySupport: res.sent ? [...post.mySupport, k] : post.mySupport.filter((x) => x !== k) })
      if (res.sent) {
        pulse()
        toast(m.support.sent)
      }
    })
  }

  function send(e: FormEvent) {
    e.preventDefault()
    const text = reply.trim()
    if (!text || busy) return
    if (derogation && !derogationAck) {
      setDerogationAck(true)
      return
    }
    setBusy(true)
    const temp: PublicReply = {
      id: `tmp-${Date.now()}`,
      authorHandle: post.isMine ? post.authorHandle : viewer.displayName,
      glyphSeed: post.isMine ? post.glyphSeed : viewer.glyphSeed,
      isAuthor: post.isMine,
      body: text,
      deleted: false,
      isMine: true,
      pending: false,
      helpful: false,
      hiddenByAuthor: false,
      createdAt: new Date().toISOString(),
    }
    setReply('')
    setDerogationAck(false)
    startTransition(async () => {
      addReplyOptimistic(temp)
      const res = await createReply(post.id, text)
      setBusy(false)
      if (!res.ok) {
        setReply(text)
        return toast(res.error)
      }
      onChange({ ...post, replies: [...post.replies, res.reply], replyCount: post.replyCount + (post.isMine ? 0 : 1) })
      pulse()
      // Krisensprache in der eigenen Antwort: derselbe Vollbild-Hinweis wie nach einem Gedanken.
      if (res.acute) setAcute(true)
      else toast(res.reply.pending ? m.replies.pending : m.replies.sent)
      input.current?.focus({ preventScroll: true })
    })
  }

  async function replyAction(r: PublicReply, kind: 'helpful' | 'hide') {
    const value = kind === 'helpful' ? !r.helpful : !r.hiddenByAuthor
    const res = kind === 'helpful' ? await markHelpful(r.id, value) : await hideReply(r.id, value)
    if (!res.ok) return toast(res.error)
    onChange({ ...post, replies: post.replies.map((x) => (x.id === r.id ? { ...x, [kind === 'helpful' ? 'helpful' : 'hiddenByAuthor']: value } : x)) })
    if (kind === 'helpful' && value) toast(m.replies.helpfulMarked)
  }

  async function removeOwnReply(r: PublicReply) {
    if (!(await askConfirm(m.replies.deleteConfirm, m.replies.delete))) return
    const res = await deleteReply(r.id)
    if (!res.ok) return toast(res.error)
    onChange({ ...post, replies: post.replies.map((x) => (x.id === r.id ? { ...x, deleted: true, body: null } : x)) })
    toast(m.replies.deleted)
  }

  /** Antwort unter Namen: Konto blockieren. Antwort der Verfasserin eines anonymen Gedankens: nur diesen ausblenden. */
  async function blockReplyAuthor(r: PublicReply) {
    const anon = r.isAuthor && post.anonymous
    const f = m.feed
    if (!(await askConfirm(anon ? f.hideAnonymousConfirm : f.blockConfirm, anon ? f.hideAnonymous : f.block))) return
    const res = await blockAuthor({ type: 'reply', id: r.id })
    if (!res.ok) return toast(res.error)
    if (anon) onRemove(post.id)
    else onChange({ ...post, replies: post.replies.filter((x) => x.id !== r.id) })
    toast(anon ? f.hiddenAnonymous : f.blocked)
  }

  const f = m.feed
  const menuItems = post.isMine
    ? [
        ...(post.canEdit ? [{ label: f.editPost, onSelect: () => emit('compose', { edit: post }) }] : []),
        {
          label: post.closed ? f.openThread : f.closeThread,
          onSelect: async () => {
            const res = await setClosed(post.id, !post.closed)
            if (res.ok) onChange({ ...post, closed: !post.closed })
          },
        },
        {
          label: f.deletePost,
          danger: true,
          onSelect: async () => {
            if (!(await askConfirm(f.deleteConfirm, f.deletePost))) return
            const res = await deletePost(post.id)
            if (!res.ok) return toast(res.error)
            onRemove(post.id)
            toast(f.deleted)
          },
        },
      ]
    : [
        {
          label: post.bookmarked ? f.unbookmark : f.bookmark,
          onSelect: async () => {
            const res = await toggleBookmark(post.id)
            if (!res.ok) return toast(res.error)
            onChange({ ...post, bookmarked: res.bookmarked })
            if (res.bookmarked) toast(f.bookmarked)
          },
        },
        { label: f.report, onSelect: () => onReport({ type: 'post', id: post.id }) },
        {
          label: post.anonymous ? f.hideAnonymous : f.block,
          danger: true,
          onSelect: async () => {
            const label = post.anonymous ? f.hideAnonymous : f.block
            if (!(await askConfirm(post.anonymous ? f.hideAnonymousConfirm : f.blockConfirm, label))) return
            const res = await blockAuthor({ type: 'post', id: post.id })
            if (!res.ok) return toast(res.error)
            onRemove(post.id)
            toast(post.anonymous ? f.hiddenAnonymous : f.blocked)
          },
        },
      ]

  const brave = post.need === 'brave'
  // Wer Text markiert, will kopieren – nicht öffnen.
  const openable = onOpen
    ? {
        role: 'button' as const,
        tabIndex: 0,
        onClick: () => {
          if (!window.getSelection()?.toString()) onOpen()
        },
        onKeyDown: (e: KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onOpen()
          }
        },
      }
    : {}
  return (
    <article className={`post${open ? ' open' : ''}`} aria-labelledby={`p-${post.id}`}>
      <div className="post-meta">
        <Glyph seed={post.glyphSeed} mood={post.mood} />
        <div>
          <div className="who" id={`p-${post.id}`}>
            {post.isMine && post.authorHandle === m.common.anonymous ? `${m.common.anonymous} (${m.common.you.toLowerCase()})` : post.authorHandle}
          </div>
          <div>
            {post.circle.name} · <span suppressHydrationWarning>{relativeTime(post.createdAt)}</span>
            {post.editedAt && ` · ${f.edited}`}
            <span className="need-mobile"> · {m.needs[post.need]}</span>
          </div>
        </div>
        <div className="meta-right">
          <span className={`need${brave ? ' brave' : ''}`}>{m.needs[post.need]}</span>
          <Menu items={menuItems} label={f.menu} />
        </div>
      </div>

      {post.isMine && post.status === 'pending' && <p className="status-note">{f.pendingMine}</p>}
      {post.isMine && post.status === 'hidden' && (
        <p className="status-note">
          {f.hiddenMine} {post.moderationNote && f.hiddenReason(post.moderationNote)}
        </p>
      )}

      {revealed ? (
        <p className={`post-text${onOpen ? ' openable' : ''}`} {...openable}>
          {post.body}
        </p>
      ) : (
        <button
          type="button"
          className="cw"
          onClick={() => {
            setRevealed(true)
            if (!viewer.collapseWarnings) rememberReveal(post.id)
          }}
        >
          <b>{f.cwLabel}</b>
          <span>{f.cwReveal}</span>
        </button>
      )}
      {revealed && post.media && (
        <div className={onOpen ? 'openable' : undefined} {...openable} aria-label={onOpen ? f.openPost : undefined}>
          <PostImage media={post.media} />
        </div>
      )}

      {post.isMine && (post.crisisLevel === 'concern' || post.crisisLevel === 'acute') && (
        <div className="care">
          {f.concernCard} <a href="tel:143">143</a> · <a href="tel:147">147</a> · <a href="tel:144">144</a>
        </div>
      )}

      {!rc && !post.isMine && !post.closed && <p className="unheard">{f.unheard}</p>}

      <div className="support">
        {post.isMine ? (
          post.supportSummary && (
            <span className="summary">
              {f.supportSummary(post.supportSummary.total)}
              {post.supportSummary.total > 0 && (
                <small>{f.supportBreakdown(post.supportSummary.hear, post.supportSummary.same, post.supportSummary.strong)}</small>
              )}
            </span>
          )
        ) : (
          SUPPORT_KINDS.map((k) => (
            <button key={k} type="button" className="sup" aria-pressed={mySupport.includes(k)} onClick={() => support(k)}>
              {m.support[k]}
            </button>
          ))
        )}
        <button
          type="button"
          className="reply-toggle"
          aria-expanded={open}
          onClick={() => {
            setOpen(!open)
            if (!open) setTimeout(() => input.current?.focus({ preventScroll: true }), 30)
          }}
        >
          {m.replies.count(rc)}
        </button>
      </div>

      <div className="replies">
        {visibleReplies.map((r) => (
          <div key={r.id} className={`reply${r.hiddenByAuthor ? ' hidden-by-author' : ''}`}>
            {!r.deleted && <Glyph seed={r.glyphSeed} mood={1} small />}
            <div className="reply-body">
              {r.deleted ? (
                <span className="gone">{f.deletedReply}</span>
              ) : (
                <>
                  <b>{r.isMine && !r.isAuthor ? `${r.authorHandle} (${m.common.you.toLowerCase()})` : r.authorHandle}</b>
                  {r.isAuthor && <span className="tag">{m.replies.author}</span>}
                  {r.body}
                  {r.pending && <span className="fine"> · {m.replies.pending}</span>}
                  {r.isMine && r.helpful && <div className="helpful-tag">{m.replies.helpfulForYou}</div>}
                  {r.hiddenByAuthor && post.isMine && <div className="fine">{m.replies.hiddenByAuthor}</div>}
                  {post.isMine && !r.isMine && !r.id.startsWith('tmp-') && (
                    <div className="reply-actions">
                      <button type="button" aria-pressed={r.helpful} onClick={() => replyAction(r, 'helpful')}>
                        {m.replies.helpful}
                      </button>
                      <button type="button" onClick={() => replyAction(r, 'hide')}>
                        {r.hiddenByAuthor ? m.replies.unhide : m.replies.hide}
                      </button>
                    </div>
                  )}
                  {!r.isMine && !r.id.startsWith('tmp-') && (
                    <div className="reply-actions">
                      {!post.isMine && (
                        <button type="button" onClick={() => onReport({ type: 'reply', id: r.id })}>
                          {f.report}
                        </button>
                      )}
                      <button type="button" onClick={() => blockReplyAuthor(r)}>
                        {r.isAuthor && post.anonymous ? f.hideAnonymous : f.block}
                      </button>
                    </div>
                  )}
                  {r.isMine && !r.id.startsWith('tmp-') && (
                    <div className="reply-actions">
                      <button type="button" onClick={() => removeOwnReply(r)}>
                        {m.replies.delete}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ))}

        {post.closed ? (
          <p className="hint">{m.replies.closed}</p>
        ) : (
          <>
            {!post.isMine && NO_ADVICE_NEEDS.includes(post.need) && <p className="hint">{m.replies.noAdvice}</p>}
            <div className="chips">
              {m.replies.suggestions.map((t) => (
                <button
                  key={t}
                  type="button"
                  className="chip"
                  onClick={() => {
                    setReply(t)
                    input.current?.focus()
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
            <form className="reply-form" onSubmit={send}>
              <input
                ref={input}
                value={reply}
                onChange={(e) => {
                  setReply(e.target.value)
                  setDerogationAck(false)
                }}
                maxLength={LIMITS.replyMax}
                autoComplete="off"
                placeholder={m.replies.placeholder}
                aria-label={m.replies.label}
              />
              <button className="send" aria-label={derogationAck ? m.replies.sendAnyway : m.replies.send} disabled={!reply.trim() || busy}>
                →
              </button>
            </form>
            {derogation && derogationAck && (
              <p className="care" role="alert">
                {m.replies.derogation} <b>{m.replies.sendAnyway}: →</b>
              </p>
            )}
            {pii.length > 0 && (
              <p className="pii">
                {m.composer.pii} {pii.map((p) => p.text).join(', ')}
              </p>
            )}
            {crisis && <CareNote />}
          </>
        )}
      </div>
      <AcuteDialog open={acute} onClose={() => setAcute(false)} />
    </article>
  )
}

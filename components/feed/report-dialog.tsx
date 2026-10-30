'use client'

import { useState, type FormEvent } from 'react'
import { reportContent } from '@/app/(app)/actions'
import { toast } from '@/lib/client/bus'
import { REPORT_REASONS, type ReportReason } from '@/lib/constants'
import { m } from '@/messages'
import { Dialog } from '../dialog'

export type ReportTarget = { type: 'post' | 'reply'; id: string } | null

export function ReportDialog({ target, onClose }: { target: ReportTarget; onClose: () => void }) {
  const [reason, setReason] = useState<ReportReason>('worry')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [showTips, setShowTips] = useState(false)
  const r = m.report

  function close() {
    setShowTips(false)
    setNote('')
    setReason('worry')
    onClose()
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!target) return
    setBusy(true)
    const res = await reportContent({ ...target, reason, note })
    setBusy(false)
    if (!res.ok) return toast(res.error)
    toast(r.thanks)
    // «Ich mache mir Sorgen» zeigt, wie man selbst gut reagieren kann.
    if (reason === 'worry') setShowTips(true)
    else close()
  }

  return (
    <Dialog open={target !== null} onClose={close} title={showTips ? r.worryTitle : r.title}>
      {showTips ? (
        <div className="stack">
          <ul className="tips">
            {r.worryTips.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <div className="dlg-foot">
            <span className="count">{m.common.fine}</span>
            <button type="button" className="btn" onClick={close}>
              {m.common.done}
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="stack">
          <p className="fine">{r.intro}</p>
          <div className="reasons" role="radiogroup" aria-label={r.title}>
            {REPORT_REASONS.map((k) => (
              <label key={k} className="reason">
                <input type="radio" name="reason" value={k} checked={reason === k} onChange={() => setReason(k)} />
                {r.reasons[k]}
              </label>
            ))}
          </div>
          <div>
            <label className="field-label" htmlFor="report-note">
              {r.note}
            </label>
            <textarea id="report-note" className="input" style={{ minHeight: 80 }} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="dlg-foot">
            <button type="button" className="btn ghost" onClick={close}>
              {m.common.cancel}
            </button>
            <button className="btn" disabled={busy}>
              {r.submit}
            </button>
          </div>
        </form>
      )}
    </Dialog>
  )
}

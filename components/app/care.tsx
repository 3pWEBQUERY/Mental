'use client'

import { defaultHelp } from '@/lib/help'
import { currentLocale, m } from '@/messages'
import { Dialog } from '../dialog'
import { PhoneScript } from '../ui'
import { useModerationAway } from './use-moderation-away'

/** Name der Stelle hinter einer Nummer in der aktuellen Sprache (143: Die Dargebotene Hand / La Main Tendue / Telefono Amico). */
function lineName(phone: string) {
  return defaultHelp(currentLocale()).find((h) => h.phone === phone)?.name ?? ''
}

/** Ruhiger Hinweis bei Krisensprache. Blockiert das Teilen nie. */
export function CareNote() {
  const c = m.care
  return (
    <div className="care" role="status">
      {c.text} <a href="tel:143">143</a> {lineName('143')} ({c.allDay}) · <a href="tel:147">147</a> {c.youth} · {c.acuteDanger}{' '}
      <a href="tel:144">144</a>. {c.canShare}
    </div>
  )
}

/** Vollbild-Hinweis nach dem Teilen eines als «acute» eingestuften Gedankens. */
export function AcuteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const a = m.acute
  const away = useModerationAway()
  return (
    <Dialog open={open} onClose={onClose} className="acute" label={`${a.titleLead} ${a.titleEm}`}>
      <div className="inner">
        <h2>
          {a.titleLead} <em>{a.titleEm}</em>
        </h2>
        <p>{a.body}</p>
        <div className="call">
          <a href="tel:143">
            <b>143</b>
            <span>
              {lineName('143')} · {m.care.allDay}
            </span>
          </a>
          <a href="tel:147">
            <b>147</b>
            <span>Pro Juventute · {m.care.youth}</span>
          </a>
          <a href="tel:144" className="urgent">
            <b>144</b>
            <span>
              {lineName('144')} · {m.care.acuteDanger}
            </span>
          </a>
        </div>
        <PhoneScript />
        <p className="fine">{a.note}</p>
        <p className="fine">{a.pending}</p>
        {away && <p className="notice night-note">{m.night.acute}</p>}
        <div>
          <button type="button" className="btn ghost" onClick={onClose}>
            {a.stay}
          </button>
        </div>
      </div>
    </Dialog>
  )
}

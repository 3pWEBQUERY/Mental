'use client'

import { useEffect, useState } from 'react'

const LANGS = [
  { code: 'de', short: 'DE', name: 'Deutsch' },
  { code: 'fr', short: 'FR', name: 'Français' },
  { code: 'it', short: 'IT', name: 'Italiano' },
] as const

/**
 * Sprachumschalter DE · FR · IT (Kopf der öffentlichen Seiten). Jeder Eintrag führt über /sprache, das die Wahl
 * speichert und zurückkehrt. Jiaia sendet keinen Referer (Datenschutz) – darum hängt der Link die aktuelle Seite
 * selbst an. Ohne JavaScript: zurück zur Hauptseite bzw. zur Hilfeseite der neuen Sprache.
 * Die Sprachnamen stehen immer in ihrer eigenen Sprache.
 */
export function LangSwitch({ current, label, fallback = '/' }: { current: 'de' | 'fr' | 'it'; label: string; fallback?: string }) {
  const [back, setBack] = useState(fallback)
  useEffect(() => setBack(window.location.pathname + window.location.search), [])
  return (
    <div className="lang-switch" role="group" aria-label={label}>
      {LANGS.map((l) => (
        <a
          key={l.code}
          href={`/sprache?l=${l.code}&zurueck=${encodeURIComponent(back)}`}
          lang={l.code}
          hrefLang={l.code}
          aria-current={l.code === current ? 'true' : undefined}
          title={l.name}
          rel="nofollow"
        >
          <span aria-hidden="true">{l.short}</span>
          <span className="sr-only">{l.name}</span>
        </a>
      ))}
    </div>
  )
}

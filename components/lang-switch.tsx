'use client'

import { useEffect, useState } from 'react'

/**
 * Link zum Sprachwechsel. Jiaia sendet keinen Referer (Datenschutz) – darum hängt der Link die aktuelle
 * Seite selbst an, damit /sprache dorthin zurückkehrt. Ohne JavaScript: zurück zur Hauptseite bzw. Hilfeseite.
 */
export function LangSwitch({ to, label, fallback = '/' }: { to: 'de' | 'fr'; label: string; fallback?: string }) {
  const [back, setBack] = useState(fallback)
  useEffect(() => setBack(window.location.pathname + window.location.search), [])
  return (
    <a href={`/sprache?l=${to}&zurueck=${encodeURIComponent(back)}`} lang={to} hrefLang={to} rel="nofollow">
      {label}
    </a>
  )
}

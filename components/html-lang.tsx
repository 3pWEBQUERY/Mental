'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

/** Nur deutsche Seiten (vorgerendert) bzw. feste Sprache – wie im Startskript (lib/prefs-script.ts). */
const GERMAN_ONLY = ['hilfe', 'datenschutz', 'impressum', 'offline']

/**
 * <html lang> nach einer Navigation im Browser nachführen: Das Startskript läuft nur beim ersten Laden.
 * Ohne das bliebe die Seitensprache nach /aide → /hilfe auf Französisch, und Screenreader läsen Deutsch
 * mit französischer Aussprache.
 */
export function HtmlLang() {
  const path = usePathname()
  useEffect(() => {
    const seg = path.split('/')[1] ?? ''
    const cookie = ` ${document.cookie};`
    const ui = cookie.includes(' lichtung_lang=fr;') ? 'fr' : cookie.includes(' lichtung_lang=it;') ? 'it' : 'de'
    const lang = seg === 'aide' ? 'fr' : seg === 'aiuto' ? 'it' : GERMAN_ONLY.includes(seg) ? 'de' : ui
    document.documentElement.lang = `${lang}-CH`
    // Installierte App in der gewählten Sprache (Name, Beschreibung, Kurzbefehle) – das vorgerenderte Manifest ist
    // deutsch, und Browser senden beim Abruf keinen Cookie.
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')
    if (link) link.href = ui === 'de' ? '/manifest.webmanifest' : `/api/manifest/${ui}`
  }, [path])
  return null
}

'use client'

import { useEffect } from 'react'
import { m } from '@/messages'

/**
 * Diskret-Modus (Einstellungen → Darstellung): Der Tab heisst neutral «Notizen», und sobald das
 * Fenster den Fokus verliert, verschwimmt der Inhalt – für geteilte Geräte und neugierige Blicke.
 */
export function DiscreetGuard() {
  useEffect(() => {
    const d = document.documentElement
    const neutral = m.settings.discreetTitle
    let real = document.title
    const syncTitle = () => {
      if (d.dataset.discreet) {
        if (document.title !== neutral) {
          real = document.title
          document.title = neutral
        }
      } else if (document.title === neutral && real) document.title = real
    }
    const veil = () => {
      if (d.dataset.discreet) d.dataset.veiled = '1'
    }
    const unveil = () => delete d.dataset.veiled
    const onVisibility = () => (document.visibilityState === 'hidden' ? veil() : unveil())
    // Next.js setzt den Titel bei jeder Navigation neu – darum beobachten statt einmal setzen.
    const mo = new MutationObserver(syncTitle)
    mo.observe(document.head, { subtree: true, childList: true, characterData: true })
    window.addEventListener('blur', veil)
    window.addEventListener('focus', unveil)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('lichtung:prefs', syncTitle)
    syncTitle()
    // Im Diskret-Modus legt Jiaia keine neuen Einträge im Verlauf an: Wechsel innerhalb der App ersetzen den
    // aktuellen Eintrag. So bleibt nach dem Schnell-Ausblenden (das genau diesen Eintrag ersetzt) nichts von Jiaia
    // im Zurück-Verlauf des Tabs.
    const push = window.history.pushState
    window.history.pushState = function (this: History, ...args: Parameters<History['pushState']>) {
      if (d.dataset.discreet) return window.history.replaceState(...args)
      return push.apply(this, args)
    }
    return () => {
      window.history.pushState = push
      mo.disconnect()
      window.removeEventListener('blur', veil)
      window.removeEventListener('focus', unveil)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('lichtung:prefs', syncTitle)
    }
  }, [])
  return null
}

'use client'

import { useEffect, useState } from 'react'
import { applyLocalPrefs, readLocalPrefs } from '@/lib/prefs-script'
import { m } from '@/messages'

function isDark() {
  const t = document.documentElement.dataset.theme
  return t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
}

/** Hell/Dunkel im Header. Hell ist Standard; die Wahl bleibt in diesem Browser gespeichert. */
export function ThemeToggle({ labels }: { labels?: { toLight: string; toDark: string; toggle: string } } = {}) {
  const l = labels ?? { toLight: m.settings.toLight, toDark: m.settings.toDark, toggle: m.settings.toggleTheme }
  // Server und erster Client-Render sind hell – erst nach dem Mount gilt die gespeicherte Wahl.
  const [dark, setDark] = useState(false)
  useEffect(() => setDark(isDark()), [])

  function toggle() {
    const next = !dark
    applyLocalPrefs({ ...readLocalPrefs(), theme: next ? 'dark' : 'light' })
    setDark(next)
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-pressed={dark}
      aria-label={dark ? l.toLight : l.toDark}
      title={l.toggle}
    >
      {dark ? (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M19.5 14.6A8 8 0 0 1 9.4 4.5a8 8 0 1 0 10.1 10.1Z" />
        </svg>
      )}
    </button>
  )
}

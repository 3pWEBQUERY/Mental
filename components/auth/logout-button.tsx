'use client'

import { logout } from '@/app/(auth)/actions'
import { forgetPrivate } from '@/lib/client/private-storage'

/**
 * Abmelden mit vollem Neuladen: Eine Weiterleitung innerhalb der App liesse die zuletzt besuchten Seiten der Person
 * im Speicher des Tabs (React Activity, Router-Cache) – mit «Zurück» sähe die nächste Person am Gerät sie noch.
 * Abgemeldet wird über /api/logout (keine Server Action – die liesse Next die aktuelle Seite neu rendern).
 * Ohne JavaScript greift die normale Server-Aktion mit Weiterleitung.
 */
export function LogoutButton({ label, className = 'btn ghost' }: { label: string; className?: string }) {
  return (
    <form
      action={logout}
      onSubmit={async (e) => {
        e.preventDefault()
        const button = e.currentTarget.querySelector('button')
        if (button) button.disabled = true
        await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {})
        forgetPrivate()
        window.location.replace('/anmelden')
      }}
    >
      <button className={className}>{label}</button>
    </form>
  )
}

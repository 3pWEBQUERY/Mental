'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import { toast } from '@/lib/client/bus'

/**
 * Logo hochladen: an /api/admin/partner-media (Route Handler, bis 3 MB). Danach lädt die Seite neu, das Logo steht
 * in den Medien und – wenn gewählt – gleich beim Partner.
 */
export function LogoUpload({ partners }: { partners: { id: string; name: string }[] }) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [, start] = useTransition()
  const ref = useRef<HTMLFormElement>(null)
  return (
    <form
      ref={ref}
      className="card inline-form"
      aria-label="Logo hochladen"
      aria-busy={busy || undefined}
      onSubmit={async (e) => {
        e.preventDefault()
        if (busy) return
        const form = e.currentTarget
        setError('')
        setBusy(true)
        try {
          const res = await fetch('/api/admin/partner-media', { method: 'POST', body: new FormData(form) })
          const body = (await res.json().catch(() => ({}))) as { message?: string; error?: string }
          if (!res.ok) {
            setError(body.error ?? 'Das hat nicht geklappt. Bitte noch einmal versuchen.')
            return
          }
          toast(body.message ?? 'Hochgeladen.')
          form.reset()
          start(() => router.refresh())
        } catch {
          setError('Keine Verbindung. Bitte noch einmal versuchen.')
        } finally {
          setBusy(false)
        }
      }}
    >
      <input className="input" type="file" name="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif,image/avif" aria-label="Bilddatei (PNG, JPEG, WebP, SVG, bis 3 MB)" required />
      <select className="input" name="partnerId" defaultValue="" aria-label="Direkt einem Partner zuweisen" style={{ flex: '0 0 220px', minWidth: 200 }}>
        <option value="">Nur in die Medien</option>
        {partners.map((p) => (
          <option key={p.id} value={p.id}>
            Logo für: {p.name}
          </option>
        ))}
      </select>
      <button className="btn small" disabled={busy}>
        {busy ? 'Lädt hoch …' : 'Hochladen'}
      </button>
      {error && (
        <p className="error" role="alert" style={{ flexBasis: '100%', margin: 0 }}>
          {error}
        </p>
      )}
    </form>
  )
}

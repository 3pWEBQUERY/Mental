'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { APPLE_PATH } from '@/lib/app-store'

/** Zuletzt gezeigt (ms) – danach 30 Tage Ruhe, egal ob geladen, weggetippt oder übergangen. */
const KEY = 'jiaia-app-sheet'
const QUIET_MS = 30 * 24 * 60 * 60 * 1000
const DELAY_MS = 1400

export type AppSheetText = {
  label: string
  eyebrow: string
  titleLead: string
  titleEm: string
  text: string
  cta: string
  ctaLabel: string
  later: string
}

/** iPhone, iPod und iPad – auch das iPad, das sich als Mac ausgibt (Touch-Punkte verraten es). */
function isIos() {
  const ua = navigator.userAgent
  return /iPhone|iPod|iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}

/**
 * Hinweis auf die iOS-App als Blatt von unten – nur auf iPhone und iPad, nur auf den öffentlichen Seiten (nie auf der
 * Hilfe, beim Anmelden, im Raum), einmal und dann 30 Tage nicht mehr. Nicht als installierte Web-App.
 */
export function AppSheet({ href, sky, t }: { href: string; sky: string; t: AppSheetText }) {
  const ref = useRef<HTMLDialogElement>(null)
  const [show, setShow] = useState(false)
  const titleId = useId()
  const pathname = usePathname()
  const firstPath = useRef(pathname)

  useEffect(() => {
    let last = 0
    try {
      last = Number(localStorage.getItem(KEY)) || 0
    } catch {}
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
    if (!isIos() || standalone || Date.now() - last < QUIET_MS) return
    const timer = window.setTimeout(() => setShow(true), DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    const d = ref.current
    if (!show || !d) return
    if (!d.open) d.showModal()
    // Fokus aufs Blatt selbst statt auf den ersten Knopf: Screenreader lesen es vor, ohne dass ein Fokusrahmen aufleuchtet.
    d.querySelector<HTMLElement>('.app-sheet-inner')?.focus()
    try {
      localStorage.setItem(KEY, String(Date.now()))
    } catch {}
    // Wird die Seite verborgen (Seitenwechsel), schliesst das Blatt – ein offener modaler Dialog machte sonst die
    // nächste Seite unbedienbar.
    return () => d.close()
  }, [show])

  // Seitenwechsel: das Blatt gehört zur ersten Seite.
  useEffect(() => {
    if (pathname !== firstPath.current) setShow(false)
  }, [pathname])

  if (!show) return null
  return (
    <dialog
      ref={ref}
      className="app-sheet"
      aria-labelledby={titleId}
      onClose={() => setShow(false)}
      onClick={(e) => {
        // Tipp neben das Blatt (auf den Hintergrund) schliesst es.
        if (e.target === e.currentTarget) e.currentTarget.close()
      }}
    >
      <div className="app-sheet-inner" tabIndex={-1}>
        <div className="app-sheet-sky" style={{ ['--sky' as string]: `url(${sky})` }} aria-hidden="true">
          <span className="app-sheet-grabber" />
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="app-sheet-icon" src="/icons/icon-512.png" alt="" width={512} height={512} />
        <div className="app-sheet-body">
          <p className="app-sheet-eyebrow">{t.eyebrow}</p>
          <h2 id={titleId} className="app-sheet-title">
            {t.titleLead} <em>{t.titleEm}</em>
          </h2>
          <p className="app-sheet-text">{t.text}</p>
          <a className="app-sheet-cta" href={href} target="_blank" rel="noopener noreferrer" aria-label={t.ctaLabel} onClick={() => ref.current?.close()}>
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d={APPLE_PATH} />
            </svg>
            {t.cta}
          </a>
          <button type="button" className="app-sheet-later" onClick={() => ref.current?.close()}>
            {t.later}
          </button>
        </div>
      </div>
    </dialog>
  )
}

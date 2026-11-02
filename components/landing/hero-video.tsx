'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Bewegter Hintergrund der Startseite. Das Video ist aus den Einzelbildern der Vorlage neu aufgebaut
 * (scripts/hero-video.sh):
 * - 13,5 s Schleife: Das Ende blendet in den Anfang über, darum ohne sichtbaren Sprung.
 * - Je Format zwei Fassungen, AV1 (klein) und H.264 (läuft überall): Querformat 1920×1080, Hochformat ein
 *   Ausschnitt 720×1280 aus der Bildmitte – auf dem Handy so scharf wie das Standbild.
 *
 * Ladezeit: Das Standbild (erstes Bild der Schleife) steht sofort da und zählt für die Ladezeit. Das Video lädt erst,
 * wenn die Seite fertig ist, und blendet ein, sobald es läuft. Nie bei «weniger Bewegung», Datensparmodus oder
 * langsamer Verbindung. Ausserhalb des Bildschirms oder im Hintergrund-Tab hält es an.
 */
const BASE = '/hero/v1'
/** Wie das Standbild (<picture> in hero.tsx): Ausschnitt fürs Hochformat ab 9:16. */
const PORTRAIT = '(max-aspect-ratio: 9/16)'
const AV1 = 'video/mp4; codecs="av01.0.08M.08"'

function stillWanted() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true
  // Bewegung in den Jiaia-Einstellungen reduziert oder aus (lib/prefs-script.ts).
  if (document.documentElement.dataset.motion) return true
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
  return Boolean(c?.saveData || /(^|-)2g$/.test(c?.effectiveType ?? ''))
}

export function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    const video = ref.current
    if (!video || stillWanted()) return
    const portrait = window.matchMedia(PORTRAIT).matches
    const av1 = video.canPlayType(AV1) === 'probably'
    const src = `${BASE}/${portrait ? 'mobile' : 'desktop'}-${av1 ? 'av1' : 'h264'}.mp4`

    let visible = true
    let started = false
    const sync = () => {
      if (!started) return
      if (visible && !document.hidden && !stillWanted()) void video.play().catch(() => {})
      else video.pause()
    }
    const start = () => {
      if (started) return
      started = true
      video.muted = true
      video.src = src
      sync()
    }
    // Erst wenn die Seite geladen ist und der Browser Zeit hat – das Standbild und der Text gehen vor.
    let idle: number | undefined
    const later = () => {
      const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }
      idle = w.requestIdleCallback ? w.requestIdleCallback(start, { timeout: 2000 }) : window.setTimeout(start, 300)
    }
    if (document.readyState === 'complete') later()
    else window.addEventListener('load', later, { once: true })

    const io = new IntersectionObserver(([e]) => {
      visible = Boolean(e?.isIntersecting)
      sync()
    })
    io.observe(video)
    const onPlaying = () => setPlaying(true)
    video.addEventListener('playing', onPlaying)
    document.addEventListener('visibilitychange', sync)
    window.addEventListener('lichtung:prefs', sync)
    return () => {
      window.removeEventListener('load', later)
      const w = window as Window & { cancelIdleCallback?: (id: number) => void }
      if (idle !== undefined) (w.cancelIdleCallback ?? window.clearTimeout)(idle)
      io.disconnect()
      video.removeEventListener('playing', onPlaying)
      document.removeEventListener('visibilitychange', sync)
      window.removeEventListener('lichtung:prefs', sync)
      video.pause()
      video.removeAttribute('src')
      video.load()
    }
  }, [])

  return (
    <video
      ref={ref}
      className={playing ? 'hero-video on' : 'hero-video'}
      muted
      loop
      playsInline
      preload="none"
      disablePictureInPicture
      disableRemotePlayback
      aria-hidden="true"
      tabIndex={-1}
    />
  )
}

'use client'

import type { PublicPost } from '../dto'

/**
 * Kleiner Ereignis-Bus zwischen entkoppelten Client-Komponenten
 * (Feed → Kugel, überall → Toast, Navigation → Dialoge).
 */
export type BusEvents = {
  toast: string
  pulse: undefined
  /** prompt: «Frage vom Team», auf die der neue Gedanke antwortet (circle = Kreis der Frage). */
  compose: { text?: string; edit?: PublicPost; circle?: string; prompt?: { id: string; text: string; circle: string } } | undefined
  help: undefined
  breathe: undefined
  grounding: undefined
  notifications: undefined
  'post-created': PublicPost
  'post-updated': PublicPost
  /** Ein Gedanke öffnet sich in der Gedanken-Spalte (feed-column.tsx) statt in einem Dialog. */
  'open-post': PublicPost
  /** Gelöscht oder ausgeblendet in der geöffneten Ansicht – der Feed nimmt ihn heraus. */
  'post-removed': string
  'checkin-mood': number
}

export function emit<K extends keyof BusEvents>(name: K, detail?: BusEvents[K]) {
  window.dispatchEvent(new CustomEvent(`lichtung:${name}`, { detail }))
}

export function on<K extends keyof BusEvents>(name: K, fn: (detail: BusEvents[K]) => void) {
  const handler = (e: Event) => fn((e as CustomEvent<BusEvents[K]>).detail)
  window.addEventListener(`lichtung:${name}`, handler)
  return () => window.removeEventListener(`lichtung:${name}`, handler)
}

export const toast = (msg: string) => emit('toast', msg)
export const pulse = () => emit('pulse')

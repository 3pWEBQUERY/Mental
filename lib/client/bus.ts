'use client'

import type { PublicPost } from '../dto'

/**
 * Kleiner Ereignis-Bus zwischen entkoppelten Client-Komponenten
 * (Feed → Kugel, überall → Toast, Navigation → Dialoge).
 */
export type BusEvents = {
  toast: string
  pulse: undefined
  compose: { text?: string; edit?: PublicPost; circle?: string } | undefined
  help: undefined
  breathe: undefined
  notifications: undefined
  'post-created': PublicPost
  'post-updated': PublicPost
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

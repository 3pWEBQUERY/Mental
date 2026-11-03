'use client'

import { toast } from './bus'

/** Ein Hinweis über einen vollen Seitenaufbau hinweg (nach der Anmeldung). Nur im Tab, nur einmal. */
const KEY = 'jiaia-notice'

export function carryNotice(text: string) {
  try {
    sessionStorage.setItem(KEY, text)
  } catch {
    toast(text)
  }
}

export function showCarriedNotice() {
  try {
    const text = sessionStorage.getItem(KEY)
    if (!text) return
    sessionStorage.removeItem(KEY)
    // Kurz warten, bis die Toast-Anzeige bereit ist.
    setTimeout(() => toast(text), 300)
  } catch {}
}

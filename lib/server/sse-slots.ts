import 'server-only'

/**
 * Obergrenzen für offene Live-Verbindungen (Glocke, /api/events) je Web-Replika:
 * - je Konto höchstens PER_USER – eine neue Verbindung (z. B. ein weiterer Tab) verdrängt die älteste;
 *   der verdrängte Tab verbindet sich erst wieder, wenn er in den Vordergrund kommt (kein Hin und Her);
 * - insgesamt höchstens TOTAL – danach 503, der Browser versucht es später wieder.
 * So kann niemand mit vielen Verbindungen Speicher und Datenbank-Abfragen einer Replika aufbrauchen.
 */
const PER_USER = 4
const TOTAL = Number(process.env.SSE_MAX_CONNECTIONS ?? 4000)

type Slot = { close: () => void }
const byUser = new Map<string, Slot[]>()
let total = 0

/** Platz für eine neue Verbindung reservieren. null = Replika voll. Die Rückgabe gibt den Platz wieder frei. */
export function takeSlot(userId: string, evict: () => void): (() => void) | null {
  const list = byUser.get(userId) ?? []
  while (list.length >= PER_USER) {
    const oldest = list.shift()!
    total--
    oldest.close()
  }
  if (total >= TOTAL) {
    if (!list.length) byUser.delete(userId)
    return null
  }
  const slot: Slot = { close: evict }
  list.push(slot)
  byUser.set(userId, list)
  total++
  let released = false
  return () => {
    if (released) return
    released = true
    const l = byUser.get(userId)
    const i = l?.indexOf(slot) ?? -1
    if (l && i >= 0) {
      l.splice(i, 1)
      total--
      if (!l.length) byUser.delete(userId)
    }
  }
}

export function openConnections() {
  return total
}

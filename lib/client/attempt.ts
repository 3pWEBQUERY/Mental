'use client'

import { m } from '@/messages'
import { toast } from './bus'

/** Erfolgsfall ohne die Fehler-Varianten – nach attempt() ist nur noch das Ergebnis übrig. */
type Success<T> = Exclude<T, { ok: false } | null | undefined | false>

/**
 * Führt eine Server Action aus und lässt Fehler nie still verschwinden: Wirft sie (Netz weg, Deploy),
 * oder meldet sie `ok: false`, erscheint eine ruhige Meldung. Gibt null zurück, wenn es nicht geklappt hat.
 */
export async function attempt<T>(fn: () => Promise<T>): Promise<Success<T> | null> {
  try {
    const res = await fn()
    if (res === null || res === undefined || res === false) {
      toast(m.common.error)
      return null
    }
    if (typeof res === 'object' && 'ok' in res && res.ok === false) {
      toast((res as unknown as { error?: string }).error || m.common.error)
      return null
    }
    return res as Success<T>
  } catch {
    toast(m.common.error)
    return null
  }
}

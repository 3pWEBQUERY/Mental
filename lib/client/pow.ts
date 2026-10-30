'use client'

import { solveChallenge } from 'altcha-lib/v1'

/** Löst die ALTCHA-Aufgabe im Hintergrund (Proof-of-Work) und liefert die Nutzlast fürs Formular. */
export async function solvePow(): Promise<string | null> {
  try {
    const res = await fetch('/api/altcha', { cache: 'no-store' })
    const ch = (await res.json()) as { algorithm: string; challenge: string; salt: string; signature: string; maxnumber?: number }
    const solution = await solveChallenge(ch.challenge, ch.salt, ch.algorithm, ch.maxnumber).promise
    if (!solution) return null
    return btoa(
      JSON.stringify({ algorithm: ch.algorithm, challenge: ch.challenge, number: solution.number, salt: ch.salt, signature: ch.signature }),
    )
  } catch {
    return null
  }
}

import 'server-only'
import { createChallenge, verifySolution } from 'altcha-lib/v1'
import { hmac } from './crypto'
import { hit } from './rate-limit'

const key = () => hmac('altcha', 'altcha-key')

/** Unsichtbarer Bot-Schutz per Proof-of-Work. Selbst gehostet, kein Tracking durch Dritte. */
export function newChallenge() {
  return createChallenge({ hmacKey: key(), maxNumber: 120_000, expires: new Date(Date.now() + 10 * 60_000) })
}

export async function verifyPow(payload: string | undefined | null): Promise<boolean> {
  if (!payload) return false
  try {
    const ok = await verifySolution(payload, key(), true)
    if (!ok) return false
    // Jede Lösung nur einmal.
    const { signature } = JSON.parse(Buffer.from(payload, 'base64').toString()) as { signature: string }
    const once = await hit(`altcha:${signature}`, 1, 15 * 60_000)
    return once.ok
  } catch {
    return false
  }
}

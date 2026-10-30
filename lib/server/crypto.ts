import 'server-only'
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { env } from './env'

export const sha256 = (v: string) => createHash('sha256').update(v).digest('hex')
export const hmac = (v: string, purpose: string) => createHmac('sha256', `${env.secret}:${purpose}`).update(v).digest('hex')
export const token = (bytes = 32) => randomBytes(bytes).toString('base64url')

export function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

/** Signierter, kurzlebiger Wert für Cookies (z. B. WebAuthn-Challenge). */
export function seal<T>(value: T, ttlMs: number, purpose: string): string {
  const body = Buffer.from(JSON.stringify({ v: value, exp: Date.now() + ttlMs })).toString('base64url')
  return `${body}.${hmac(body, purpose)}`
}

export function unseal<T>(sealed: string | undefined, purpose: string): T | null {
  if (!sealed) return null
  const [body, sig] = sealed.split('.')
  if (!body || !sig || !safeEqual(sig, hmac(body, purpose))) return null
  try {
    const { v, exp } = JSON.parse(Buffer.from(body, 'base64url').toString()) as { v: T; exp: number }
    return exp > Date.now() ? v : null
  } catch {
    return null
  }
}

/** Interne, nicht rückführbare Mitglieds-ID für Moderator:innen – nie der Benutzername. */
export function memberRef(userId: string) {
  return `M-${hmac(userId, 'member-ref').slice(0, 8).toUpperCase()}`
}

/** Zufällige Saat für die organische Form. */
export function randomSeed() {
  return randomBytes(4).readInt32BE() & 0x7fffffff
}

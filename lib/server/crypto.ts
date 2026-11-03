import 'server-only'
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
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

/**
 * Wie seal, aber verschlüsselt (AES-256-GCM, Schlüssel aus dem App-Geheimnis je Zweck): Der Inhalt ist nicht
 * lesbar – z. B. die Konto-ID im Link auf die Kontoseite der Moderation.
 */
export function encSeal<T>(value: T, ttlMs: number, purpose: string): string {
  const key = createHash('sha256').update(`${env.secret}:enc:${purpose}`).digest()
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', key, iv)
  const body = Buffer.concat([c.update(JSON.stringify({ v: value, exp: Date.now() + ttlMs }), 'utf8'), c.final()])
  return Buffer.concat([iv, c.getAuthTag(), body]).toString('base64url')
}

export function encUnseal<T>(sealed: string | undefined, purpose: string): T | null {
  if (!sealed || sealed.length > 512) return null
  try {
    const raw = Buffer.from(sealed, 'base64url')
    if (raw.length < 29) return null
    const key = createHash('sha256').update(`${env.secret}:enc:${purpose}`).digest()
    const d = createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12))
    d.setAuthTag(raw.subarray(12, 28))
    const { v, exp } = JSON.parse(Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString('utf8')) as { v: T; exp: number }
    return exp > Date.now() ? v : null
  } catch {
    return null
  }
}

/**
 * Kennung eines Teammitglieds in Audit-Log und Fallübernahme – bewusst eine andere als memberRef: Sonst liesse sich
 * im Moderationsbereich verknüpfen, welche anonymen Gedanken von welcher Kollegin stammen.
 */
export function staffRef(userId: string) {
  return `T-${hmac(userId, 'staff-ref').slice(0, 6).toUpperCase()}`
}

/** Interne, nicht rückführbare Mitglieds-ID für Moderator:innen – nie der Benutzername. */
export function memberRef(userId: string) {
  return `M-${hmac(userId, 'member-ref').slice(0, 8).toUpperCase()}`
}

/** Zufällige Saat für die organische Form. */
export function randomSeed() {
  return randomBytes(4).readInt32BE() & 0x7fffffff
}

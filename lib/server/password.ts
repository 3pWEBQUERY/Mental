import 'server-only'
import { hash, verify } from '@node-rs/argon2'
import { createHash } from 'node:crypto'
import { env } from './env'

// Argon2id nach OWASP-Empfehlung (19 MiB, 2 Durchläufe).
const OPTS = { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const

export const hashSecret = (plain: string) => hash(plain, OPTS)

export async function verifySecret(hashed: string, plain: string) {
  try {
    return await verify(hashed, plain)
  } catch {
    return false
  }
}

// Gleiche Laufzeit, auch wenn es den Benutzernamen nicht gibt.
let dummy: Promise<string> | null = null
export async function burnTime(plain: string) {
  dummy ??= hashSecret('lichtung-dummy-passwort')
  await verifySecret(await dummy, plain)
}

/**
 * Have I Been Pwned mit k-Anonymity: nur die ersten 5 Zeichen des SHA-1-Hashes verlassen den Server.
 * Fällt der Dienst aus, wird nicht blockiert (fail open) – die Mindestlänge gilt trotzdem.
 */
export async function isPwned(password: string): Promise<boolean> {
  if (!env.hibpEnabled) return false
  const sha1 = createHash('sha1').update(password).digest('hex').toUpperCase()
  const prefix = sha1.slice(0, 5)
  const suffix = sha1.slice(5)
  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true', 'User-Agent': 'Lichtung' },
      signal: AbortSignal.timeout(2500),
      cache: 'no-store',
    })
    if (!res.ok) return false
    const body = await res.text()
    return body.split('\n').some((line) => {
      const [s, count] = line.trim().split(':')
      return s === suffix && Number(count) > 0
    })
  } catch {
    return false
  }
}

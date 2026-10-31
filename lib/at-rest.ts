import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

/**
 * Verschlüsselung besonders schützenswerter Gesundheitsdaten in der Datenbank (Notfallplan, Briefe an sich
 * selbst, Check-in-Notizen). AES-256-GCM mit einem eigenen Schlüssel ausserhalb der Datenbank
 * (DATA_ENCRYPTION_KEY, 32 Byte Base64): Wer nur einen Datenbank-Dump oder ein Backup in die Hände bekommt,
 * liest diese Texte nicht. Die Konto-ID ist als Zusatzdaten gebunden – ein Wert lässt sich nicht einem anderen
 * Konto unterschieben.
 *
 * Ohne Schlüssel bleibt alles wie bisher (Klartext); ältere Klartext-Werte werden immer noch gelesen.
 * Der Schlüssel darf nie verloren gehen – ohne ihn sind diese Texte nicht mehr lesbar (README).
 */
const PREFIX = 'enc:v1:'

function key(): Buffer | null {
  const raw = process.env.DATA_ENCRYPTION_KEY
  if (!raw) return null
  const k = Buffer.from(raw, 'base64')
  if (k.length !== 32) throw new Error('DATA_ENCRYPTION_KEY muss 32 Byte (Base64) lang sein')
  return k
}

export function atRestEnabled() {
  return key() !== null
}

export function sealText(userId: string, plain: string): string
export function sealText(userId: string, plain: string | null): string | null
export function sealText(userId: string, plain: string | null): string | null {
  const k = key()
  if (plain === null || !k || plain.startsWith(PREFIX)) return plain
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', k, iv)
  c.setAAD(Buffer.from(userId))
  const body = Buffer.concat([c.update(plain, 'utf8'), c.final()])
  return PREFIX + Buffer.concat([iv, c.getAuthTag(), body]).toString('base64url')
}

export function openText(userId: string, stored: string): string
export function openText(userId: string, stored: string | null): string | null
export function openText(userId: string, stored: string | null): string | null {
  if (stored === null || !stored.startsWith(PREFIX)) return stored
  const k = key()
  if (!k) throw new Error('Verschlüsselte Daten, aber kein DATA_ENCRYPTION_KEY gesetzt')
  const raw = Buffer.from(stored.slice(PREFIX.length), 'base64url')
  const d = createDecipheriv('aes-256-gcm', k, raw.subarray(0, 12))
  d.setAAD(Buffer.from(userId))
  d.setAuthTag(raw.subarray(12, 28))
  return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString('utf8')
}

/** JSON (z. B. der Notfallplan in einer jsonb-Spalte): verschlüsselt als { _enc }. */
export function sealJson<T>(userId: string, value: T): T {
  if (!atRestEnabled()) return value
  return { _enc: sealText(userId, JSON.stringify(value)) } as unknown as T
}

export function openJson<T>(userId: string, value: T | null): T | null {
  if (value && typeof value === 'object' && '_enc' in value && typeof (value as { _enc: unknown })._enc === 'string') {
    return JSON.parse(openText(userId, (value as unknown as { _enc: string })._enc)) as T
  }
  return value
}

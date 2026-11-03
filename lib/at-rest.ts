import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

/**
 * Verschlüsselung besonders schützenswerter Gesundheitsdaten in der Datenbank (Notfallplan, Briefe an sich
 * selbst, Check-in-Notizen). AES-256-GCM mit einem eigenen Schlüssel ausserhalb der Datenbank
 * (DATA_ENCRYPTION_KEY, 32 Byte Base64): Wer nur einen Datenbank-Dump oder ein Backup in die Hände bekommt,
 * liest diese Texte nicht. Die Konto-ID ist als Zusatzdaten gebunden – ein Wert lässt sich nicht einem anderen
 * Konto unterschieben.
 *
 * Ohne Schlüssel bleibt alles wie bisher (Klartext); ältere Klartext-Werte und v1-Werte werden immer noch gelesen.
 * Der Schlüssel darf nie verloren gehen – ohne ihn sind diese Texte nicht mehr lesbar (README).
 */
const V1 = 'enc:v1:'
const V2 = 'enc:v2:'
/** Klartext, der zufällig wie ein verschlüsselter Wert beginnt («enc:…»), wird ohne Schlüssel so markiert. */
const RAW = 'raw:'

type Key = { id: string; key: Buffer }

function parse(raw: string, name: string): Key {
  const k = Buffer.from(raw.trim(), 'base64')
  if (k.length !== 32) throw new Error(`${name} muss 32 Byte (Base64) lang sein`)
  return { id: createHash('sha256').update(k).digest('hex').slice(0, 8), key: k }
}

/**
 * Aktueller Schlüssel (DATA_ENCRYPTION_KEY) und frühere (DATA_ENCRYPTION_KEYS_OLD, durch Komma getrennt).
 * Schlüsselwechsel: neuen Schlüssel setzen, den alten nach DATA_ENCRYPTION_KEYS_OLD verschieben, deployen –
 * scripts/encrypt-at-rest.ts verschlüsselt danach alles mit dem neuen. Erst dann den alten entfernen.
 */
function keys(): { current: Key | null; all: Key[] } {
  const raw = process.env.DATA_ENCRYPTION_KEY
  const current = raw ? parse(raw, 'DATA_ENCRYPTION_KEY') : null
  const old = (process.env.DATA_ENCRYPTION_KEYS_OLD ?? '')
    .split(',')
    .filter((x) => x.trim())
    .map((x) => parse(x, 'DATA_ENCRYPTION_KEYS_OLD'))
  return { current, all: current ? [current, ...old] : old }
}

export function atRestEnabled() {
  return keys().current !== null
}

/** Kennung des aktuellen Schlüssels (die ersten 8 Hex-Zeichen seines SHA-256) – verrät nichts über den Schlüssel. */
export function currentKeyId(): string | null {
  return keys().current?.id ?? null
}

/** Präfix eines Werts, der mit dem aktuellen Schlüssel verschlüsselt ist (für SQL-Filter im Skript). */
export function currentPrefix(): string | null {
  const id = currentKeyId()
  return id ? `${V2}${id}:` : null
}

export function sealText(userId: string, plain: string): string
export function sealText(userId: string, plain: string | null): string | null
export function sealText(userId: string, plain: string | null): string | null {
  if (plain === null) return null
  const k = keys().current
  if (!k) return plain.startsWith('enc:') || plain.startsWith(RAW) ? RAW + plain : plain
  // Immer verschlüsseln – auch Text, der selbst mit «enc:» beginnt (sonst würde er beim Lesen als Chiffre gedeutet).
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', k.key, iv)
  c.setAAD(Buffer.from(userId))
  const body = Buffer.concat([c.update(plain, 'utf8'), c.final()])
  return `${V2}${k.id}:` + Buffer.concat([iv, c.getAuthTag(), body]).toString('base64url')
}

function decrypt(k: Buffer, userId: string, payload: string) {
  const raw = Buffer.from(payload, 'base64url')
  const d = createDecipheriv('aes-256-gcm', k, raw.subarray(0, 12))
  d.setAAD(Buffer.from(userId))
  d.setAuthTag(raw.subarray(12, 28))
  return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString('utf8')
}

export function openText(userId: string, stored: string): string
export function openText(userId: string, stored: string | null): string | null
export function openText(userId: string, stored: string | null): string | null {
  if (stored === null) return null
  if (stored.startsWith(RAW)) return stored.slice(RAW.length)
  const { all } = keys()
  if (stored.startsWith(V2)) {
    const sep = stored.indexOf(':', V2.length)
    const id = stored.slice(V2.length, sep)
    const k = all.find((x) => x.id === id)
    if (!k) throw new Error(`Verschlüsselte Daten mit Schlüssel ${id}, der nicht gesetzt ist (DATA_ENCRYPTION_KEY / DATA_ENCRYPTION_KEYS_OLD)`)
    return decrypt(k.key, userId, stored.slice(sep + 1))
  }
  if (stored.startsWith(V1)) {
    // v1 kennt die Schlüssel-ID nicht: alle bekannten Schlüssel probieren (GCM erkennt den falschen sicher).
    if (!all.length) throw new Error('Verschlüsselte Daten, aber kein DATA_ENCRYPTION_KEY gesetzt')
    for (const k of all) {
      try {
        return decrypt(k.key, userId, stored.slice(V1.length))
      } catch {}
    }
    throw new Error('Verschlüsselte Daten (v1) passen zu keinem gesetzten Schlüssel')
  }
  return stored
}

/** Muss der Wert (neu) verschlüsselt werden? Klartext oder ein älterer Schlüssel. */
export function needsSeal(stored: string | null) {
  const prefix = currentPrefix()
  return stored !== null && prefix !== null && !stored.startsWith(prefix)
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

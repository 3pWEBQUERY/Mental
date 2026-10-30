'use client'

/**
 * Tagebuch-Verschlüsselung im Browser (WebCrypto).
 * PIN --PBKDF2(600 000, SHA-256)--> Hauptschlüssel-Material (nur im Speicher)
 * Hauptschlüssel + Salz pro Eintrag --HKDF--> AES-GCM-256-Schlüssel pro Eintrag.
 * Der Server sieht nur Chiffretext, IV und Salz.
 */
const ITERATIONS = 600_000
const enc = new TextEncoder()
const dec = new TextDecoder()

export const b64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf)))
type Bytes = Uint8Array<ArrayBuffer>
export const unb64 = (s: string): Bytes => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
export const random = (n: number): Bytes => crypto.getRandomValues(new Uint8Array(n))

export function cryptoAvailable() {
  return typeof crypto !== 'undefined' && Boolean(crypto.subtle)
}

export async function deriveMaster(pin: string, salt: Bytes): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' }, base, 256)
  return crypto.subtle.importKey('raw', bits, 'HKDF', false, ['deriveKey'])
}

async function entryKey(master: CryptoKey, salt: Bytes) {
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: enc.encode('lichtung-journal-v1') },
    master,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptText(master: CryptoKey, text: string) {
  const salt = random(16)
  const iv = random(12)
  const key = await entryKey(master, salt)
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(text))
  return { ciphertext: b64(ct), iv: b64(iv), salt: b64(salt) }
}

export async function decryptText(master: CryptoKey, e: { ciphertext: string; iv: string; salt: string }) {
  const key = await entryKey(master, unb64(e.salt))
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(e.iv) }, key, unb64(e.ciphertext))
  return dec.decode(pt)
}

/** Prüfwert: Lässt er sich entschlüsseln, stimmt die PIN. */
export const CHECK_TEXT = 'lichtung'

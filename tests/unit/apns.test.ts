import { generateKeyPairSync, verify } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { apnsPayload, isApnsToken, parseP8, providerToken } from '@/lib/apns'

describe('APNs', () => {
  it('signiert das Anmelde-Token mit ES256 so, dass Apple es prüfen kann', () => {
    const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
    const token = providerToken({ keyId: 'ABC123DEFG', teamId: 'CY2659G6Q3', key: privateKey }, Date.UTC(2026, 10, 14))
    const [h, c, s] = token.split('.')
    expect(JSON.parse(Buffer.from(h!, 'base64url').toString())).toEqual({ alg: 'ES256', kid: 'ABC123DEFG' })
    expect(JSON.parse(Buffer.from(c!, 'base64url').toString())).toEqual({ iss: 'CY2659G6Q3', iat: Date.UTC(2026, 10, 14) / 1000 })
    const sig = Buffer.from(s!, 'base64url')
    // JWS verlangt die rohe 64-Byte-Signatur (r‖s), nicht DER.
    expect(sig.length).toBe(64)
    expect(verify('sha256', Buffer.from(`${h}.${c}`), { key: publicKey, dsaEncoding: 'ieee-p1363' }, sig)).toBe(true)
  })

  it('schickt nur neutralen Text und den Pfad für die App', () => {
    const p = apnsPayload({ title: 'Jiaia', body: 'Jemand hat dir geantwortet', url: '/start/gedanke/1', thread: 'post-1', ttl: 60 })
    expect(p).toEqual({ aps: { alert: { title: 'Jiaia', body: 'Jemand hat dir geantwortet' }, sound: 'default', 'thread-id': 'post-1' }, url: '/start/gedanke/1' })
    expect(apnsPayload({ title: 'Neue Mitteilung', body: 'Tippe zum Öffnen.', url: '/start', ttl: 60 }).aps).not.toHaveProperty('thread-id')
  })

  it('nimmt nur echte Geräte-Tokens an', () => {
    expect(isApnsToken('a'.repeat(64))).toBe(true)
    expect(isApnsToken('A1'.repeat(40))).toBe(true)
    expect(isApnsToken('xyz')).toBe(false)
    expect(isApnsToken('g'.repeat(64))).toBe(false)
    expect(isApnsToken({ length: 64 })).toBe(false)
  })
})

describe('APNs-Schlüssel aus Railway', () => {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString().trim()
  const body = pem.split('\n').filter((l) => !l.startsWith('-----')).join('')

  it.each([
    ['wie in der Datei', pem],
    ['mit maskierten Zeilenumbrüchen', pem.replace(/\n/g, '\\n')],
    ['als eine Zeile mit Leerzeichen', pem.replace(/\n/g, ' ')],
    ['ohne Kopf- und Fusszeile', body],
    ['in Anführungszeichen', `"${pem}"`],
  ])('liest den Schlüssel %s', (_, raw) => {
    const key = parseP8(raw)
    expect(key?.asymmetricKeyType).toBe('ec')
  })

  it('lehnt Unsinn ab, ohne zu werfen', () => {
    expect(parseP8('${{APNS_KEY}}')).toBeNull()
    expect(parseP8('kein schlüssel')).toBeNull()
  })
})

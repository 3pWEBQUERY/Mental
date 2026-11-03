import { describe, expect, it } from 'vitest'
import { WORDS } from '@/lib/auth/wordlist'
import { clientIp, ipBucket } from '@/lib/client-ip'
import { isPushEndpoint } from '@/lib/push-endpoint'
import { displayNameProblem } from '@/lib/display-name'
import { needsSeal, openJson, openText, sealJson, sealText } from '@/lib/at-rest'
import { glyphPath, rng } from '@/lib/glyph'
import { sniffImage } from '@/lib/image-sniff'
import { inQuietHours } from '@/lib/quiet-hours'
import { isValidUsername, looksLikeRealName, suggestUsername } from '@/lib/username'

describe('Benutzername', () => {
  it('erlaubt nur a–z, 0–9, Punkt und Unterstrich, 3–24 Zeichen', () => {
    expect(isValidUsername('stiller.ahorn')).toBe(true)
    expect(isValidUsername('moos_42')).toBe(true)
    expect(isValidUsername('ab')).toBe(false)
    expect(isValidUsername('Mira')).toBe(false)
    expect(isValidUsername('mira müller')).toBe(false)
    expect(isValidUsername('.mira')).toBe(false)
  })
  it('schlägt gültige, nicht rückführbare Namen vor', () => {
    const r = rng(1)
    for (let i = 0; i < 50; i++) expect(isValidUsername(suggestUsername(r))).toBe(true)
  })
  it('weist sanft auf Klarnamen hin', () => {
    expect(looksLikeRealName('anna.meier')).toBe(true)
    expect(looksLikeRealName('lukasmueller')).toBe(true)
    expect(looksLikeRealName('stiller.ahorn')).toBe(false)
  })
})

describe('Wiederherstellungsschlüssel', () => {
  it('hat eine eindeutige Wortliste ohne Umlaute', () => {
    expect(new Set(WORDS).size).toBe(WORDS.length)
    expect(WORDS.every((w) => /^[a-z]+$/.test(w))).toBe(true)
    expect(12 * Math.log2(WORDS.length)).toBeGreaterThan(96)
  })
})

describe('Organische Form', () => {
  it('ist deterministisch pro Saat', () => {
    expect(glyphPath(7, 2)).toBe(glyphPath(7, 2))
    expect(glyphPath(7, 2)).not.toBe(glyphPath(8, 2))
  })
})

describe('Ruhezeiten', () => {
  it('gelten über Mitternacht', () => {
    expect(inQuietHours(23, 22, 7)).toBe(true)
    expect(inQuietHours(3, 22, 7)).toBe(true)
    expect(inQuietHours(7, 22, 7)).toBe(false)
    expect(inQuietHours(12, 22, 7)).toBe(false)
    expect(inQuietHours(13, 12, 14)).toBe(true)
  })
})

describe('Bildprüfung per Magic Bytes', () => {
  it('erkennt echte Formate und lehnt getarnte Dateien ab', () => {
    expect(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpeg')
    expect(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe('png')
    expect(sniffImage(new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 '))).toBe('webp')
    expect(sniffImage(new TextEncoder().encode('<html><script>'))).toBeNull()
  })
})

describe('clientIp', () => {
  const h = (o: Record<string, string>) => new Headers(o)
  it('nimmt hinter Railway die gesetzte X-Real-IP', () => {
    process.env.RAILWAY_ENVIRONMENT_ID = 'test'
    expect(clientIp(h({ 'x-real-ip': '203.0.113.7', 'x-forwarded-for': '1.2.3.4, 203.0.113.7' }))).toBe('203.0.113.7')
    expect(clientIp(h({ 'x-real-ip': '2001:db8::1' }))).toBe('2001:db8::1')
    // Kein gültige IP → nicht als eigener Limit-Topf.
    expect(clientIp(h({ 'x-real-ip': 'zufall-123', 'x-forwarded-for': '198.51.100.9' }))).toBe('198.51.100.9')
    expect(clientIp(h({ 'x-real-ip': 'zufall-123' }))).toBe('unknown')
    delete process.env.RAILWAY_ENVIRONMENT_ID
  })
  it('traut X-Real-IP ohne Railway nicht (könnte vom Client kommen)', () => {
    expect(clientIp(h({ 'x-real-ip': '6.6.6.6', 'x-forwarded-for': '198.51.100.2' }))).toBe('198.51.100.2')
    process.env.TRUST_X_REAL_IP = '1'
    expect(clientIp(h({ 'x-real-ip': '6.6.6.6', 'x-forwarded-for': '198.51.100.2' }))).toBe('6.6.6.6')
    delete process.env.TRUST_X_REAL_IP
  })
  it('akzeptiert Port und Klammern, nicht aber Unsinn', () => {
    expect(clientIp(h({ 'x-forwarded-for': '198.51.100.2:5123' }))).toBe('198.51.100.2')
    expect(clientIp(h({ 'x-forwarded-for': '[2001:db8::2]:443' }))).toBe('2001:db8::2')
    expect(clientIp(h({ 'x-forwarded-for': 'a'.repeat(500) }))).toBe('unknown')
  })
  it('ignoriert den vom Client gefälschten ersten X-Forwarded-For-Eintrag', () => {
    expect(clientIp(h({ 'x-forwarded-for': '6.6.6.6, 198.51.100.2' }))).toBe('198.51.100.2')
  })
  it('fällt ohne Header auf «unknown» zurück', () => {
    expect(clientIp(h({}))).toBe('unknown')
  })
})

describe('ipBucket', () => {
  it('lässt IPv4 unverändert', () => {
    expect(ipBucket('203.0.113.7')).toBe('203.0.113.7')
  })
  it('fasst IPv6 auf das /64-Netz zusammen – Adresswechsel im selben Netz umgehen kein Limit', () => {
    expect(ipBucket('2001:db8:85a3:12::1')).toBe('2001:db8:85a3:12::/64')
    expect(ipBucket('2001:db8:85a3:12:ffff:abcd:1:2')).toBe('2001:db8:85a3:12::/64')
    expect(ipBucket('2001:0db8:85a3:0012:0000:0000:0000:0042')).toBe('2001:db8:85a3:12::/64')
  })
  it('behandelt :: am Anfang, Zonen und eingebettete IPv4', () => {
    expect(ipBucket('::1')).toBe('0:0:0:0::/64')
    expect(ipBucket('fe80::1%eth0')).toBe('fe80:0:0:0::/64')
    expect(ipBucket('::ffff:198.51.100.2')).toBe('198.51.100.2')
  })
})

describe('isPushEndpoint', () => {
  it('erlaubt die Push-Dienste der Browser', () => {
    expect(isPushEndpoint('https://fcm.googleapis.com/fcm/send/abc:def')).toBe(true)
    expect(isPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/gAAA')).toBe(true)
    expect(isPushEndpoint('https://web.push.apple.com/QGx')).toBe(true)
    expect(isPushEndpoint('https://wns2-par02p.notify.windows.com/w/?token=x')).toBe(true)
  })
  it('lehnt interne und fremde Adressen ab (kein SSRF über den Worker)', () => {
    expect(isPushEndpoint('http://postgres.railway.internal/')).toBe(false)
    expect(isPushEndpoint('http://10.0.0.1:5432')).toBe(false)
    expect(isPushEndpoint('https://fcm.googleapis.com.evil.example/x')).toBe(false)
    expect(isPushEndpoint('https://evilfcm.googleapis.com/x')).toBe(false)
    expect(isPushEndpoint('http://fcm.googleapis.com/fcm/send/x')).toBe(false)
    expect(isPushEndpoint('https://fcm.googleapis.com:8443/x')).toBe(false)
    expect(isPushEndpoint('https://user:pw@fcm.googleapis.com/x')).toBe(false)
    expect(isPushEndpoint('kein url')).toBe(false)
  })
})

describe('displayNameProblem', () => {
  it('lässt gewöhnliche Namen zu', () => {
    for (const n of ['Mira', 'Nachtfalter', 'Jonas K.', 'Leise Wolke', 'Teamplayer']) expect(displayNameProblem(n)).toBeNull()
  })
  it('lehnt persönliche Angaben ab', () => {
    for (const n of ['Mira 079 123 45 67', 'mira@example.ch', 'Insta @mira.k', 'www.mira.ch', '0 7 9 1 2 3 4']) expect(displayNameProblem(n)).toBe('personal')
  })
  it('lehnt vorgetäuschte Autorität ab', () => {
    for (const n of ['Moderation', 'Jiaia Team', 'Lichtung Team', 'Moderazione', 'Team ufficiale', 'Admin Sara', 'Offizieller Support', 'Modératrice']) expect(displayNameProblem(n)).toBe('official')
  })
})

describe('Verschlüsselung im Ruhezustand', () => {
  const key = Buffer.alloc(32, 7).toString('base64')
  const A = '11111111-1111-4111-8111-111111111111'
  const B = '22222222-2222-4222-8222-222222222222'
  it('verschlüsselt mit Schlüssel, liest zurück und bindet an das Konto', () => {
    process.env.DATA_ENCRYPTION_KEY = key
    const sealed = sealText(A, 'Mein Notfallplan')
    expect(sealed).toMatch(/^enc:v2:[0-9a-f]{8}:/)
    expect(sealed).not.toContain('Notfallplan')
    expect(openText(A, sealed)).toBe('Mein Notfallplan')
    expect(() => openText(B, sealed)).toThrow()
    expect(needsSeal(sealed)).toBe(false)
    expect(needsSeal('klar')).toBe(true)
    const plan = { signs: 'a', self: 'b' }
    expect(openJson(A, sealJson(A, plan))).toEqual(plan)
    delete process.env.DATA_ENCRYPTION_KEY
  })
  it('Text, der selbst mit «enc:» beginnt, bleibt lesbar – mit und ohne Schlüssel', () => {
    delete process.env.DATA_ENCRYPTION_KEY
    const tricky = 'enc:v1:das habe ich so geschrieben'
    const plain = sealText(A, tricky)
    expect(plain).toBe('raw:' + tricky)
    expect(openText(A, plain)).toBe(tricky)
    expect(openText(A, sealText(A, 'raw:x'))).toBe('raw:x')
    process.env.DATA_ENCRYPTION_KEY = key
    expect(openText(A, sealText(A, tricky))).toBe(tricky)
    expect(openText(A, plain)).toBe(tricky)
    delete process.env.DATA_ENCRYPTION_KEY
  })
  it('Schlüsselwechsel: alte Werte (v1 und v2) bleiben mit DATA_ENCRYPTION_KEYS_OLD lesbar', async () => {
    const { createCipheriv, randomBytes } = await import('node:crypto')
    // v1-Wert wie bisher gespeichert
    const iv = randomBytes(12)
    const c = createCipheriv('aes-256-gcm', Buffer.from(key, 'base64'), iv)
    c.setAAD(Buffer.from(A))
    const body = Buffer.concat([c.update('alt v1', 'utf8'), c.final()])
    const v1 = 'enc:v1:' + Buffer.concat([iv, c.getAuthTag(), body]).toString('base64url')
    process.env.DATA_ENCRYPTION_KEY = key
    const v2 = sealText(A, 'alt v2')
    expect(openText(A, v1)).toBe('alt v1')
    const next = Buffer.alloc(32, 9).toString('base64')
    process.env.DATA_ENCRYPTION_KEY = next
    expect(() => openText(A, v2)).toThrow(/nicht gesetzt/)
    expect(() => openText(A, v1)).toThrow()
    process.env.DATA_ENCRYPTION_KEYS_OLD = key
    expect(openText(A, v1)).toBe('alt v1')
    expect(openText(A, v2)).toBe('alt v2')
    expect(needsSeal(v2)).toBe(true)
    const resealed = sealText(A, openText(A, v2))
    expect(needsSeal(resealed)).toBe(false)
    delete process.env.DATA_ENCRYPTION_KEYS_OLD
    expect(openText(A, resealed)).toBe('alt v2')
    delete process.env.DATA_ENCRYPTION_KEY
  })
  it('liest alten Klartext weiter und lässt ohne Schlüssel alles unverändert', () => {
    delete process.env.DATA_ENCRYPTION_KEY
    expect(sealText(A, 'klar')).toBe('klar')
    expect(openText(A, 'klar')).toBe('klar')
    expect(openJson(A, { signs: 'x' })).toEqual({ signs: 'x' })
    expect(sealText(A, null)).toBeNull()
  })
})

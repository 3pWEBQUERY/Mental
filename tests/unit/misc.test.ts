import { describe, expect, it } from 'vitest'
import { WORDS } from '@/lib/auth/wordlist'
import { clientIp, ipBucket } from '@/lib/client-ip'
import { isPushEndpoint } from '@/lib/push-endpoint'
import { displayNameProblem } from '@/lib/display-name'
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
  it('nimmt die von Railway gesetzte X-Real-IP', () => {
    expect(clientIp(h({ 'x-real-ip': '203.0.113.7', 'x-forwarded-for': '1.2.3.4, 203.0.113.7' }))).toBe('203.0.113.7')
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
    for (const n of ['Moderation', 'Lichtung Team', 'Admin Sara', 'Offizieller Support', 'Modératrice']) expect(displayNameProblem(n)).toBe('official')
  })
})

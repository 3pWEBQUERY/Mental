import { describe, expect, it } from 'vitest'
import { WORDS } from '@/lib/auth/wordlist'
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

import { describe, expect, it } from 'vitest'
import { detectCrisis } from '@/lib/crisis'
import { detectAdvice } from '@/lib/advice'
import { detectDerogation } from '@/lib/derogation'
import { detectPii } from '@/lib/pii'

describe('Krisenerkennung (Stufe 1)', () => {
  it('erkennt akute Krisensprache, auch mit Umlauten und Gross/klein', () => {
    expect(detectCrisis('Ich MÖCHTE STERBEN.')).toBe('acute')
    expect(detectCrisis('manchmal will ich einfach nicht mehr leben')).toBe('acute')
  })
  it('erkennt Mundart', () => {
    expect(detectCrisis('i wott sterbe')).toBe('acute')
  })
  it('stuft Sorge niedriger ein als akut', () => {
    expect(detectCrisis('Es hat alles keinen Sinn mehr')).toBe('concern')
  })
  it('lässt normale Sätze in Ruhe', () => {
    expect(detectCrisis('Sonntage sind am schwersten.')).toBe('none')
    expect(detectCrisis('Ich habe das Stück «Sterben lernen» gesehen')).toBe('none')
  })
  it('nutzt eine gepflegte Wortliste', () => {
    expect(detectCrisis('total hoffnungslos', [{ term: 'hoffnungslos', level: 'acute' }])).toBe('acute')
  })
})

describe('Persönliche Daten', () => {
  it('findet Telefonnummern, E-Mail, Handles und Adressen', () => {
    const kinds = detectPii('Ruf an: 079 123 45 67 oder +41 44 123 45 67, mail an mira@example.ch, @mira.lu, Bahnhofstrasse 12, 8004 Zürich').map((p) => p.kind)
    expect(kinds).toEqual(['phone', 'phone', 'email', 'handle', 'address', 'address'])
  })
  it('meldet die E-Mail nicht zusätzlich als Handle', () => {
    expect(detectPii('mira@example.ch').map((p) => p.kind)).toEqual(['email'])
  })
  it('ignoriert kurze Zahlen', () => {
    expect(detectPii('Tag 14, seit 3 Wochen')).toEqual([])
  })
})

describe('Abwertung', () => {
  it('erkennt abwertende Formulierungen', () => {
    expect(detectDerogation('Stell dich nicht so an.')).toBe(true)
    expect(detectDerogation('Anderen geht es schlechter')).toBe(true)
  })
  it('lässt freundliche Antworten durch', () => {
    expect(detectDerogation('Du bist damit nicht allein.')).toBe(false)
  })
})

describe('detectAdvice', () => {
  it('erkennt Ratschläge', () => {
    expect(detectAdvice('Du solltest mal mit jemandem reden')).toBe(true)
    expect(detectAdvice('Probier es doch mal mit Sport')).toBe(true)
    expect(detectAdvice('Hast du schon versucht, früher zu schlafen?')).toBe(true)
    expect(detectAdvice('An deiner Stelle würde ich kündigen')).toBe(true)
  })
  it('lässt Zuspruch durch', () => {
    expect(detectAdvice('Ich höre dich. Das klingt wirklich schwer.')).toBe(false)
    expect(detectAdvice('Du bist damit nicht allein.')).toBe(false)
    expect(detectAdvice('Du musstest so viel tragen.')).toBe(false)
  })
})

describe('Krisenerkennung auf Französisch', () => {
  it('erkennt akute Krisensprache, mit Akzenten und Apostroph', () => {
    expect(detectCrisis("J'ai envie de mourir.")).toBe('acute')
    expect(detectCrisis('Je ne veux plus vivre comme ça')).toBe('acute')
    expect(detectCrisis('Parfois je pense à mettre fin à mes jours')).toBe('acute')
    expect(detectCrisis('je vais me suicider')).toBe('acute')
    expect(detectCrisis('J’ai des pensées suicidaires')).toBe('acute')
  })
  it('stuft Sorge niedriger ein', () => {
    expect(detectCrisis("Je n'en peux plus, ma vie n'a plus de sens")).toBe('concern')
    expect(detectCrisis('Je me sens désespérée')).toBe('concern')
  })
  it('lässt Alltagssätze in Ruhe', () => {
    expect(detectCrisis('Tu vas me tuer de rire')).toBe('none')
    expect(detectCrisis('Je cherche désespérément mes clés')).toBe('none')
    expect(detectCrisis('Les dimanches sont les plus durs.')).toBe('none')
  })
})

describe('Krisenerkennung auf Italienisch', () => {
  it('erkennt akute Krisensprache, mit Akzenten', () => {
    expect(detectCrisis('A volte voglio morire.')).toBe('acute')
    expect(detectCrisis('Non voglio più vivere così')).toBe('acute')
    expect(detectCrisis('Ho pensieri suicidi da settimane')).toBe('acute')
    expect(detectCrisis('Voglio farla finita')).toBe('acute')
  })
  it('stuft Sorge niedriger ein', () => {
    expect(detectCrisis('Non ce la faccio più, sono un peso per tutti')).toBe('concern')
    expect(detectCrisis('Mi sento disperata')).toBe('concern')
  })
  it('lässt Alltagssätze in Ruhe', () => {
    expect(detectCrisis('Facciamola finita con questa storia del parcheggio')).toBe('none')
    expect(detectCrisis('Le domeniche sono le più difficili.')).toBe('none')
  })
})

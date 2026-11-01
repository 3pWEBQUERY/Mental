import { afterEach, describe, expect, it } from 'vitest'
import { pickLocale } from '@/proxy'
import { getMessages, lazy, m } from '@/messages'
import { localCircleName, localizeCircle, localStepText } from '@/lib/localize'

const g = globalThis as { __lichtungLocale?: () => 'de' | 'fr' | undefined }
afterEach(() => delete g.__lichtungLocale)

describe('Sprache aus Accept-Language', () => {
  it('nimmt die erste unterstützte Sprache nach Gewichtung', () => {
    expect(pickLocale('fr-CH,fr;q=0.9,de;q=0.8')).toBe('fr')
    expect(pickLocale('de-CH,fr;q=0.5')).toBe('de')
    expect(pickLocale('en-US,en;q=0.9,fr;q=0.8,de;q=0.7')).toBe('fr')
    expect(pickLocale('de;q=0.4,fr;q=0.6')).toBe('fr')
  })
  it('fällt auf Deutsch zurück', () => {
    expect(pickLocale(null)).toBe('de')
    expect(pickLocale('en-US,es;q=0.8')).toBe('de')
  })
  it('erkennt Italienisch', () => {
    expect(pickLocale('it-CH,it;q=0.9,de;q=0.8')).toBe('it')
    expect(pickLocale('en-US,it;q=0.8')).toBe('it')
  })
})

describe('Wörterbuch pro Anfrage', () => {
  it('liefert ohne Anfrage Deutsch, mit Resolver die gewählte Sprache – auch über lazy()', () => {
    const auth = lazy('auth')
    expect(m.auth.login).toBe(getMessages('de').auth.login)
    g.__lichtungLocale = () => 'fr'
    expect(m.auth.login).toBe(getMessages('fr').auth.login)
    expect(auth.login).toBe(getMessages('fr').auth.login)
    expect({ ...m.report.reasons }).toEqual(getMessages('fr').report.reasons)
  })
})

describe('Inhalte aus der Datenbank', () => {
  const circle = { name: 'Angst', description: 'Für Herzrasen', rules: 'Keine Verharmlosung', i18n: { fr: { name: 'Anxiété', description: 'Pour le cœur qui s’emballe' } } }
  it('übersetzt, was übersetzt ist, und behält sonst Deutsch', () => {
    expect(localizeCircle(circle, 'fr')).toEqual({ name: 'Anxiété', description: 'Pour le cœur qui s’emballe', rules: 'Keine Verharmlosung' })
    expect(localizeCircle(circle, 'de').name).toBe('Angst')
    expect(localCircleName('Angst', null, 'fr')).toBe('Angst')
    expect(localStepText('Iss etwas Warmes.', { fr: { text: 'Mange quelque chose de chaud.' } }, 'fr')).toBe('Mange quelque chose de chaud.')
  })
})

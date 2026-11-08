import { afterEach, describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { proxy } from '@/proxy'

/**
 * Hinter dem Proxy von Railway sieht der Server die Anfrage als http://localhost:8080/… – Weiterleitungen müssen
 * trotzdem auf die öffentliche Adresse (APP_URL) zeigen, nicht auf localhost.
 */
describe('Weiterleitungen hinter einem Proxy', () => {
  const before = process.env.APP_URL
  afterEach(() => {
    process.env.APP_URL = before
  })

  it('führt ohne Sitzung zur Anmeldung auf der öffentlichen Domain', () => {
    process.env.APP_URL = 'https://jiaia.app'
    const res = proxy(new NextRequest('http://localhost:8080/einstellungen', { headers: { host: 'jiaia.app' } }))
    expect(res.headers.get('location')).toBe('https://jiaia.app/anmelden')
  })

  it('führt mit Sitzung von der Anmeldung zum Raum auf der öffentlichen Domain', () => {
    process.env.APP_URL = 'https://jiaia.app'
    const res = proxy(new NextRequest('http://localhost:8080/anmelden', { headers: { host: 'jiaia.app', cookie: 'lichtung_session=x' } }))
    expect(res.headers.get('location')).toBe('https://jiaia.app/start')
  })
})

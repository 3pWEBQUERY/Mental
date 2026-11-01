import { describe, expect, it } from 'vitest'
import { apiContext, appLocale, bearerToken } from '@/lib/server/api-context'

describe('App-Schnittstelle (/api/v1)', () => {
  it('liest nur gültige Bearer-Token', () => {
    const t = 'abcdefghijklmnopqrstuvwxyz_-0123456789AB'
    expect(bearerToken(new Headers({ authorization: `Bearer ${t}` }))).toBe(t)
    expect(bearerToken(new Headers({ authorization: `bearer ${t}` }))).toBeNull()
    expect(bearerToken(new Headers({ authorization: 'Bearer kurz' }))).toBeNull()
    expect(bearerToken(new Headers({ authorization: `Bearer ${t}; x` }))).toBeNull()
    expect(bearerToken(new Headers({ cookie: `lichtung_session=${t}` }))).toBeNull()
    expect(bearerToken(new Headers())).toBeNull()
  })

  it('gibt ein neues Token nur innerhalb des eigenen Aufrufs zurück', async () => {
    expect(apiContext.get()).toBeUndefined()
    const [a, b] = await Promise.all([
      apiContext.run(async () => {
        await new Promise((r) => setTimeout(r, 5))
        apiContext.get()!.token = 'erstes'
        return 1
      }),
      apiContext.run(async () => 2),
    ])
    expect(a).toEqual({ result: 1, token: 'erstes' })
    expect(b).toEqual({ result: 2, token: null })
    expect(apiContext.get()).toBeUndefined()
  })

  it('liest die Sprache der App nur aus «X-Locale» mit bekannten Sprachen', async () => {
    expect(appLocale(new Headers({ 'x-locale': 'fr' }))).toBe('fr')
    expect(appLocale(new Headers({ 'x-locale': ' IT ' }))).toBe('it')
    expect(appLocale(new Headers({ 'x-locale': 'en' }))).toBeUndefined()
    expect(appLocale(new Headers({ 'accept-language': 'fr-CH' }))).toBeUndefined()
    expect(await apiContext.run(async () => apiContext.get()!.locale, 'it')).toEqual({ result: 'it', token: null })
  })
})

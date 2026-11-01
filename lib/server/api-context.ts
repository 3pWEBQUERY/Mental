import 'server-only'
import { AsyncLocalStorage } from 'node:async_hooks'
import { isLocale, type Locale } from '@/messages'

/**
 * Anfragen der Apps (/api/v1): Die Sitzung kommt ausschliesslich als Bearer-Token, nie als Cookie – so kann
 * keine fremde Webseite mit dem Cookie einer angemeldeten Person über diese Schnittstelle schreiben (CSRF).
 * Meldet sich jemand an, legt `createSession` das neue Token hier ab, statt ein Cookie zu setzen.
 */
type ApiContext = { token: string | null; locale?: Locale }

// Ein Speicher für alle Server-Bundles: Die Sprache liest `requestLocale` aus dem Bundle von instrumentation.ts,
// die Anfrage läuft im Bundle der Route – ohne globalThis wären das zwei getrennte Speicher.
const g = globalThis as { __jiaiaApiContext?: AsyncLocalStorage<ApiContext> }
const storage = (g.__jiaiaApiContext ??= new AsyncLocalStorage<ApiContext>())

export const apiContext = {
  run<T>(fn: () => Promise<T>, locale?: Locale) {
    const ctx: ApiContext = { token: null, locale }
    return storage.run(ctx, async () => ({ result: await fn(), token: ctx.token }))
  },
  get: () => storage.getStore(),
}

/** «Authorization: Bearer <token>» – Browser setzen diesen Kopf nie von selbst. */
export function bearerToken(h: Headers): string | null {
  const auth = h.get('authorization') ?? ''
  const match = /^Bearer ([A-Za-z0-9_-]{20,200})$/.exec(auth.trim())
  return match?.[1] ?? null
}

/** Sprache der App: «X-Locale: de|fr|it». Die App schickt die gewählte Sprache des Kontos mit, kein Cookie. */
export function appLocale(h: Headers): Locale | undefined {
  const v = h.get('x-locale')?.trim().toLowerCase()
  return isLocale(v) ? v : undefined
}

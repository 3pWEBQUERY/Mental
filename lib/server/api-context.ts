import 'server-only'
import { AsyncLocalStorage } from 'node:async_hooks'

/**
 * Anfragen der Apps (/api/v1): Die Sitzung kommt ausschliesslich als Bearer-Token, nie als Cookie – so kann
 * keine fremde Webseite mit dem Cookie einer angemeldeten Person über diese Schnittstelle schreiben (CSRF).
 * Meldet sich jemand an, legt `createSession` das neue Token hier ab, statt ein Cookie zu setzen.
 */
type ApiContext = { token: string | null }

const storage = new AsyncLocalStorage<ApiContext>()

export const apiContext = {
  run<T>(fn: () => Promise<T>) {
    const ctx: ApiContext = { token: null }
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

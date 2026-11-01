import { workUnitAsyncStorage } from 'next/dist/server/app-render/work-unit-async-storage.external'
import { isLocale, LOCALE_COOKIE, type Locale } from '@/messages'
import { apiContext } from './api-context'

type CookieReader = { get: (name: string) => { value: string } | undefined }

/**
 * Sprache der laufenden Anfrage, synchron – damit `m.…` überall ohne `await` die richtige Sprache liefert.
 * Liest das Cookie aus dem Anfrage-Speicher von Next (dieselbe Quelle wie `cookies()`). Ausserhalb einer
 * Anfrage (Vorrendern beim Build, «use cache», Worker) gibt es keine Cookies: dann undefined → Deutsch.
 * Next-intern: Ein E2E-Test (i18n.spec.ts) prüft nach jedem Upgrade, dass Französisch ankommt.
 */
export function requestLocale(): Locale | undefined {
  // Apps (/api/v1) schicken keine Cookies, sondern die Sprache im Kopf «X-Locale».
  const api = apiContext.get()
  if (api) return api.locale
  try {
    const store = workUnitAsyncStorage.getStore() as { cookies?: unknown } | undefined
    const cookies = store?.cookies as CookieReader | undefined
    if (!cookies || typeof cookies.get !== 'function') return undefined
    const v = cookies.get(LOCALE_COOKIE)?.value
    return isLocale(v) ? v : undefined
  } catch {
    return undefined
  }
}

export function registerLocaleResolver() {
  ;(globalThis as { __lichtungLocale?: () => Locale | undefined }).__lichtungLocale = requestLocale
}

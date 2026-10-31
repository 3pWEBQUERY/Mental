import { de, type Messages } from './de'
import { fr } from './fr'

export const LOCALES = ['de', 'fr'] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'de'
/** Gewählte Sprache dieses Browsers. Nicht httpOnly: Der Browser liest sie beim Laden der Skripte. */
export const LOCALE_COOKIE = 'lichtung_lang'
/** BCP-47 für <html lang>, Intl und Screenreader. */
export const LOCALE_TAG: Record<Locale, string> = { de: 'de-CH', fr: 'fr-CH' }

const dictionaries: Record<Locale, Messages> = { de, fr }

export const isLocale = (x: unknown): x is Locale => x === 'de' || x === 'fr'

export function getMessages(locale: Locale = DEFAULT_LOCALE): Messages {
  return dictionaries[locale]
}

/**
 * Woher die Sprache kommt:
 * - **Browser:** aus dem Cookie, einmal beim Laden. Ein Sprachwechsel lädt die Seite neu.
 * - **Server (Next):** pro Anfrage aus dem Cookie. `lib/server/request-locale.ts` registriert dafür beim Start
 *   (instrumentation.ts) eine Funktion auf globalThis – sie ist in allen Server-Bundles dieselbe.
 * - **Worker, Skripte, Vorrendern beim Build:** Deutsch. Texte an bestimmte Personen holen sich die Sprache
 *   der *empfangenden* Person ausdrücklich (`getMessages(locale)`, lib/server/notify.ts).
 */
let browserLocale: Locale | undefined

function readCookieLocale(): Locale {
  const v = document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${LOCALE_COOKIE}=`))
    ?.slice(LOCALE_COOKIE.length + 1)
  return isLocale(v) ? v : DEFAULT_LOCALE
}

export function currentLocale(): Locale {
  if (typeof window !== 'undefined' && typeof document !== 'undefined') return (browserLocale ??= readCookieLocale())
  const resolve = (globalThis as { __lichtungLocale?: () => Locale | undefined }).__lichtungLocale
  return resolve?.() ?? DEFAULT_LOCALE
}

/**
 * Das Wörterbuch der aktuellen Sprache. Ein Proxy statt eines festen Objekts, damit alle bestehenden
 * `m.bereich.text`-Aufrufe ohne Umbau die richtige Sprache bekommen – auf dem Server pro Anfrage.
 * Wichtig: `m` nur innerhalb von Funktionen lesen, nie in Konstanten auf Modulebene (die blieben sonst in der
 * Sprache, in der das Modul zuerst geladen wurde).
 */
export const m: Messages = new Proxy({} as Messages, {
  get: (_, key) => (getMessages(currentLocale()) as unknown as Record<PropertyKey, unknown>)[key],
  has: (_, key) => key in getMessages(currentLocale()),
  ownKeys: () => Reflect.ownKeys(getMessages(currentLocale())),
  getOwnPropertyDescriptor: (_, key) => {
    const d = Reflect.getOwnPropertyDescriptor(getMessages(currentLocale()), key)
    return d ? { ...d, configurable: true } : undefined
  },
})

/**
 * Ein Bereich des Wörterbuchs als Abkürzung auf Modulebene (`const s = lazy('settings')`), der trotzdem bei
 * jedem Zugriff die aktuelle Sprache liest.
 */
export function lazy<K extends keyof Messages>(key: K): Messages[K] {
  const section = () => m[key] as unknown as object
  return new Proxy({} as Messages[K] & object, {
    get: (_, k) => (section() as Record<PropertyKey, unknown>)[k],
    has: (_, k) => k in section(),
    ownKeys: () => Reflect.ownKeys(section()),
    getOwnPropertyDescriptor: (_, k) => {
      const d = Reflect.getOwnPropertyDescriptor(section(), k)
      return d ? { ...d, configurable: true } : undefined
    },
  }) as Messages[K]
}

/** Sprach-Tag für Intl (Zahlen, Daten) in der aktuellen Sprache. */
export const localeTag = () => LOCALE_TAG[currentLocale()]

export type { Messages }

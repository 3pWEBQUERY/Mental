import { de, type Messages } from './de'
import { fr } from './fr'

export const LOCALES = ['de', 'fr'] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'de'

const dictionaries: Record<Locale, Messages> = { de, fr }

/**
 * Die App spricht Deutsch. Französisch gibt es bisher nur für die öffentliche Hilfeseite /aide – die Umschaltung
 * der ganzen App folgt nach der Prüfung der Texte (docs/i18n/README.md).
 */
export function getMessages(locale: Locale = DEFAULT_LOCALE): Messages {
  return dictionaries[locale]
}

export const m = getMessages()
export type { Messages }

import { de, type Messages } from './de'

export const LOCALES = ['de'] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'de'

const dictionaries: Record<Locale, Messages> = { de }

/**
 * Version 1 spricht nur Deutsch. Alle Texte laufen trotzdem über dieses Wörterbuch,
 * damit Französisch und Italienisch (Phase 4) nur eine neue Datei brauchen.
 */
export function getMessages(locale: Locale = DEFAULT_LOCALE): Messages {
  return dictionaries[locale]
}

export const m = getMessages()
export type { Messages }

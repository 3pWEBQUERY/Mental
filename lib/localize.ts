import type { CircleI18n, StepI18n } from '../db/schema'
import { currentLocale, type Locale } from '../messages'

/**
 * Inhalte aus der Datenbank (Kreise, kleine Schritte) in der aktuellen Sprache. Deutsch steht in den normalen
 * Spalten, andere Sprachen in `i18n`; fehlt eine Übersetzung, bleibt es beim deutschen Text.
 */
export function localizeCircle<T extends { name: string; description: string; rules: string; i18n?: CircleI18n | null }>(
  c: T,
  locale: Locale = currentLocale(),
): Omit<T, 'i18n'> {
  const { i18n, ...rest } = c
  const tr = locale === 'de' ? undefined : i18n?.[locale]
  return { ...rest, name: tr?.name || c.name, description: tr?.description || c.description, rules: tr?.rules || c.rules }
}

export function localCircleName(name: string, i18n: CircleI18n | null | undefined, locale: Locale = currentLocale()) {
  return (locale !== 'de' && i18n?.[locale]?.name) || name
}

export function localStepText(text: string, i18n: StepI18n | null | undefined, locale: Locale = currentLocale()) {
  return (locale !== 'de' && i18n?.[locale]?.text) || text
}

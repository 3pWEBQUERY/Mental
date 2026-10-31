import { inArray, sql } from 'drizzle-orm'
import { db } from '../db'
import { profiles } from '../db/schema'
import { DEFAULT_LOCALE, getMessages, isLocale, type Locale, type Messages } from '../messages'

/**
 * Text an eine bestimmte Person – in *ihrer* Sprache, nicht in der Sprache der Person, die ihn auslöst
 * (Moderation, Worker). Ein fester String bleibt, wie er ist; eine Funktion bekommt das passende Wörterbuch.
 * Ohne «server-only»: läuft in der App und im Worker.
 */
export type Text = string | ((t: Messages) => string)

export function renderText(text: Text, locale: Locale): string {
  return typeof text === 'string' ? text : text(getMessages(locale))
}

/** Sprache je Konto aus den Einstellungen (Standard Deutsch). */
export async function localesOf(userIds: string[]): Promise<Map<string, Locale>> {
  const out = new Map<string, Locale>()
  if (!userIds.length) return out
  const rows = await db
    .select({ userId: profiles.userId, locale: sql<string | null>`${profiles.settings}->>'locale'` })
    .from(profiles)
    .where(inArray(profiles.userId, userIds))
  for (const id of userIds) out.set(id, DEFAULT_LOCALE)
  for (const r of rows) if (isLocale(r.locale)) out.set(r.userId, r.locale)
  return out
}

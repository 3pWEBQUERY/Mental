import 'server-only'
import { cacheLife, cacheTag } from 'next/cache'
import { asc } from 'drizzle-orm'
import { db } from '@/db'
import { circles, crisisTerms, helpResources } from '@/db/schema'
import { DEFAULT_CRISIS_TERMS, type CrisisTerm } from '../crisis'
import { DEFAULT_HELP, type HelpResource } from '../help'

/** Wortliste für Stufe 1 (Browser) und Stufe 2 (Server). Fällt die DB aus, gilt die Startliste. */
export async function getCrisisTerms(): Promise<CrisisTerm[]> {
  'use cache'
  cacheTag('crisis-terms')
  cacheLife('hours')
  try {
    const rows = await db.select({ term: crisisTerms.term, level: crisisTerms.level }).from(crisisTerms)
    return rows.length ? rows : DEFAULT_CRISIS_TERMS
  } catch {
    return DEFAULT_CRISIS_TERMS
  }
}

/** Hilfe-Nummern. Funktioniert auch, wenn die Datenbank ausfällt. */
export async function getHelpResources(): Promise<HelpResource[]> {
  'use cache'
  cacheTag('help')
  cacheLife('days')
  try {
    const rows = await db.select().from(helpResources).orderBy(asc(helpResources.sort))
    return rows.length
      ? rows.map((r) => ({ name: r.name, phone: r.phone, url: r.url, hours: r.hours, audience: r.audience }))
      : DEFAULT_HELP
  } catch {
    return DEFAULT_HELP
  }
}

export type CircleInfo = { id: string; slug: string; name: string; description: string; rules: string; color: string }

export async function getCircles(): Promise<CircleInfo[]> {
  'use cache'
  cacheTag('circles')
  cacheLife('hours')
  const rows = await db.select().from(circles).orderBy(asc(circles.sort))
  return rows
    .filter((c) => c.isActive)
    .map(({ id, slug, name, description, rules, color }) => ({ id, slug, name, description, rules, color }))
}

/**
 * Für die statische Regeln-Seite: Beim Build ist die Datenbank (privates Netzwerk) nicht erreichbar.
 * Dann bleibt die Kreisliste leer und erscheint mit der nächsten Revalidierung.
 */
export async function getCirclesForStaticPage(): Promise<CircleInfo[]> {
  'use cache'
  cacheTag('circles')
  cacheLife('hours')
  try {
    const rows = await db.select().from(circles).orderBy(asc(circles.sort))
    return rows
      .filter((c) => c.isActive)
      .map(({ id, slug, name, description, rules, color }) => ({ id, slug, name, description, rules, color }))
  } catch {
    return []
  }
}

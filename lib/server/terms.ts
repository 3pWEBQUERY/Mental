import 'server-only'
import { cacheLife, cacheTag } from 'next/cache'
import { asc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { circles, crisisTerms, helpResources } from '@/db/schema'
import { DEFAULT_CRISIS_TERMS, type CrisisTerm } from '../crisis'
import { DEFAULT_HELP, type HelpResource } from '../help'

/*
 * Der Cache liegt im Speicher jeder Web-Replika; updateTag wirkt nur auf der, die die Änderung speichert.
 * Darum kurze Lebensdauer ('minutes' = nach 1 Minute im Hintergrund neu laden): Eine Admin-Änderung
 * an Krisenbegriffen oder Nummern gilt so spätestens nach etwa einer Minute überall.
 * Die Rückfallliste bei DB-Fehlern wird nur kurz gehalten (FALLBACK), nie stundenlang. Kürzer geht nicht:
 * Beim Build ist die DB nicht erreichbar, und unter 30 s / 5 min Ablauf wäre /hilfe nicht mehr vorab
 * renderbar – der Build bricht dann ab (siehe cacheLife-Doku, «Prerendering behavior»).
 */
const FALLBACK = { stale: 30, revalidate: 30, expire: 300 }

/** Wortliste für Stufe 1 (Browser) und Stufe 2 (Server). Fällt die DB aus, gilt kurz die Startliste. */
export async function getCrisisTerms(): Promise<CrisisTerm[]> {
  'use cache'
  cacheTag('crisis-terms')
  try {
    const rows = await db.select({ term: crisisTerms.term, level: crisisTerms.level }).from(crisisTerms).where(eq(crisisTerms.active, true))
    cacheLife('minutes')
    return rows.length ? rows : DEFAULT_CRISIS_TERMS
  } catch {
    cacheLife(FALLBACK)
    return DEFAULT_CRISIS_TERMS
  }
}

/** Hilfe-Nummern. Funktioniert auch, wenn die Datenbank ausfällt. */
export async function getHelpResources(): Promise<HelpResource[]> {
  'use cache'
  cacheTag('help')
  try {
    const rows = await db.select().from(helpResources).orderBy(asc(helpResources.sort))
    cacheLife('minutes')
    return rows.length
      ? rows.map((r) => ({ name: r.name, phone: r.phone, url: r.url, hours: r.hours, audience: r.audience }))
      : DEFAULT_HELP
  } catch {
    cacheLife(FALLBACK)
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

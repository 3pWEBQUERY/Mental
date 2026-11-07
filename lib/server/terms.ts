import 'server-only'
import { cacheLife, cacheTag } from 'next/cache'
import { and, asc, eq, isNotNull, isNull } from 'drizzle-orm'
import { db } from '@/db'
import { circles, crisisTerms, helpResources, type CircleI18n } from '@/db/schema'
import { ALL_DEFAULT_CRISIS_TERMS, type CrisisTerm } from '../crisis'
import { defaultHelp, type HelpLanguage, type HelpResource } from '../help'

/*
 * Der Cache liegt im Speicher jeder Web-Replika. updateTag nach einer Admin-Änderung gilt sofort auf allen:
 * cache-handlers/default.cjs verteilt die Invalidierung per Postgres NOTIFY. Als Sicherheitsnetz, falls eine
 * Nachricht verloren geht, bleibt die Lebensdauer für Krisenbegriffe und Nummern kurz ('minutes' = nach
 * 1 Minute im Hintergrund neu laden).
 * Die Rückfallliste bei DB-Fehlern wird nur kurz gehalten (FALLBACK), nie stundenlang. Kürzer geht nicht:
 * Beim Build ist die DB nicht erreichbar, und unter 30 s / 5 min Ablauf wäre /hilfe nicht mehr vorab
 * renderbar – der Build bricht dann ab (siehe cacheLife-Doku, «Prerendering behavior»).
 */
const FALLBACK = { stale: 30, revalidate: 30, expire: 300 }

/**
 * Hilfe darf nie auf eine hängende Datenbank warten: Nach 2 Sekunden gilt die Rückfallliste (wie bei einem Fehler).
 * Ohne Grenze stünde /hilfe bis zum Verbindungs-Timeout (10 s) leer da.
 */
function quick<T>(query: PromiseLike<T>, ms = 2_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  return Promise.race([
    Promise.resolve(query).finally(() => clearTimeout(timer)),
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('db timeout')), ms)
    }),
  ])
}

/** Wortliste für Stufe 1 (Browser) und Stufe 2 (Server). Fällt die DB aus, gilt kurz die Startliste. */
export async function getCrisisTerms(): Promise<CrisisTerm[]> {
  'use cache'
  cacheTag('crisis-terms')
  try {
    const rows = await db.select({ term: crisisTerms.term, level: crisisTerms.level }).from(crisisTerms).where(eq(crisisTerms.active, true))
    cacheLife('minutes')
    return rows.length ? rows : ALL_DEFAULT_CRISIS_TERMS
  } catch {
    cacheLife(FALLBACK)
    return ALL_DEFAULT_CRISIS_TERMS
  }
}

/** Hilfe-Nummern in einer Sprache. Funktioniert auch, wenn die Datenbank ausfällt. */
export async function getHelpResources(language: HelpLanguage = 'de'): Promise<HelpResource[]> {
  'use cache'
  cacheTag('help')
  try {
    const rows = await quick(
      db
        .select()
        .from(helpResources)
        .where(and(eq(helpResources.language, language), isNull(helpResources.circleId)))
        .orderBy(asc(helpResources.sort)),
    )
    cacheLife('minutes')
    return rows.length
      ? rows.map((r) => ({ name: r.name, phone: r.phone, url: r.url, hours: r.hours, audience: r.audience }))
      : defaultHelp(language)
  } catch {
    cacheLife(FALLBACK)
    return defaultHelp(language)
  }
}

/**
 * Hilfe zu einzelnen Themen, nach Kreis-Slug: erscheint beim Kreis und auf den Hilfeseiten unter «Nach Thema».
 * Nur aktive Kreise. Fällt die DB aus, bleibt es bei der allgemeinen Hilfe (leere Liste).
 */
export async function getCircleHelp(language: HelpLanguage = 'de'): Promise<Record<string, HelpResource[]>> {
  'use cache'
  cacheTag('help')
  cacheTag('circles')
  try {
    const rows = await quick(
      db
        .select({ slug: circles.slug, name: helpResources.name, phone: helpResources.phone, url: helpResources.url, hours: helpResources.hours, audience: helpResources.audience })
        .from(helpResources)
        .innerJoin(circles, eq(circles.id, helpResources.circleId))
        .where(and(eq(helpResources.language, language), isNotNull(helpResources.circleId), eq(circles.isActive, true)))
        .orderBy(asc(circles.sort), asc(helpResources.sort)),
    )
    cacheLife('minutes')
    const out: Record<string, HelpResource[]> = {}
    for (const { slug, ...h } of rows) (out[slug] ??= []).push(h)
    return out
  } catch {
    cacheLife(FALLBACK)
    return {}
  }
}

/** Mit allen Übersetzungen – der Cache ist für alle Sprachen derselbe; übersetzt wird beim Ausliefern (localizeCircle). */
export type CircleInfo = { id: string; slug: string; name: string; description: string; rules: string; color: string; requireCw: boolean; i18n: CircleI18n }

export async function getCircles(): Promise<CircleInfo[]> {
  'use cache'
  cacheTag('circles')
  cacheLife('hours')
  const rows = await db.select().from(circles).orderBy(asc(circles.sort))
  return rows
    .filter((c) => c.isActive)
    .map(({ id, slug, name, description, rules, color, requireCw, i18n }) => ({ id, slug, name, description, rules, color, requireCw, i18n }))
}

/**
 * Für die statische Regeln-Seite: Beim Build ist die Datenbank (privates Netzwerk) nicht erreichbar.
 * Dann bleibt die Kreisliste leer und erscheint mit der nächsten Revalidierung.
 */
export async function getCirclesForStaticPage(): Promise<CircleInfo[]> {
  'use cache'
  cacheTag('circles')
  try {
    const rows = await quick(db.select().from(circles).orderBy(asc(circles.sort)))
    cacheLife('hours')
    return rows
      .filter((c) => c.isActive)
      .map(({ id, slug, name, description, rules, color, requireCw, i18n }) => ({ id, slug, name, description, rules, color, requireCw, i18n }))
  } catch {
    // Ohne Datenbank: keine Themen – aber nur kurz zwischengespeichert, nicht stundenlang.
    cacheLife(FALLBACK)
    return []
  }
}

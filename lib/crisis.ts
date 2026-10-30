import { normalize } from './text'

export type CrisisLevel = 'none' | 'concern' | 'acute'
export type CrisisTerm = { term: string; level: 'concern' | 'acute' }

/**
 * Startliste – wird beim Seeding in `crisis_terms` geschrieben und im Admin-Bereich gepflegt.
 * Die App liest die Liste aus der Datenbank; diese Konstante ist nur der Fallback,
 * falls die Datenbank nicht erreichbar ist. Vor dem Launch von einer Fachperson abzunehmen.
 */
export const DEFAULT_CRISIS_TERMS: CrisisTerm[] = [
  { term: 'will sterben', level: 'acute' },
  { term: 'sterben will', level: 'acute' },
  { term: 'moechte sterben', level: 'acute' },
  { term: 'nicht mehr leben', level: 'acute' },
  { term: 'mich umbringen', level: 'acute' },
  { term: 'mir das leben nehmen', level: 'acute' },
  { term: 'suizid', level: 'acute' },
  { term: 'selbstmord', level: 'acute' },
  { term: 'alles beenden', level: 'acute' },
  { term: 'nicht mehr aufwachen', level: 'acute' },
  { term: 'abschiedsbrief', level: 'acute' },
  { term: 'will tot sein', level: 'acute' },
  { term: 'lebensmuede', level: 'acute' },
  { term: 'von der bruecke springen', level: 'acute' },
  // Mundart
  { term: 'nuemme laebe', level: 'acute' },
  { term: 'wott sterbe', level: 'acute' },
  { term: 'mi umbringe', level: 'acute' },
  { term: 'mich verletzen', level: 'concern' },
  { term: 'selbstverletzung', level: 'concern' },
  { term: 'ritzen', level: 'concern' },
  { term: 'kein sinn mehr', level: 'concern' },
  { term: 'keinen sinn mehr', level: 'concern' },
  { term: 'hoffnungslos', level: 'concern' },
  { term: 'niemand wuerde mich vermissen', level: 'concern' },
  { term: 'besser dran ohne mich', level: 'concern' },
  { term: 'bin nur eine last', level: 'concern' },
  { term: 'halte das nicht mehr aus', level: 'concern' },
  { term: 'will verschwinden', level: 'concern' },
  { term: 'nuemme mag', level: 'concern' },
]

const RANK: Record<CrisisLevel, number> = { none: 0, concern: 1, acute: 2 }

/** Stufe 1: läuft beim Tippen im Browser. Blockiert nie, zeigt nur einen ruhigen Hinweis. */
export function detectCrisis(text: string, terms: readonly CrisisTerm[] = DEFAULT_CRISIS_TERMS): CrisisLevel {
  if (!text.trim()) return 'none'
  const hay = normalize(text)
  let level: CrisisLevel = 'none'
  for (const t of terms) {
    const needle = normalize(t.term)
    if (needle.trim() && hay.includes(needle) && RANK[t.level] > RANK[level]) {
      level = t.level
      if (level === 'acute') break
    }
  }
  return level
}

export function maxLevel(a: CrisisLevel, b: CrisisLevel): CrisisLevel {
  return RANK[a] >= RANK[b] ? a : b
}

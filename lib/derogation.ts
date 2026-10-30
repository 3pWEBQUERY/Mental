import { normalize } from './text'

/** Formulierungen, die abwertend ankommen. Löst vor dem Senden einen Hinweis aus, blockiert aber nicht. */
const PHRASES = [
  'stell dich nicht so an',
  'reiss dich zusammen',
  'reiss dich mal zusammen',
  'anderen geht es schlechter',
  'anderen gehts schlechter',
  'selber schuld',
  'selbst schuld',
  'jammer nicht',
  'hoer auf zu jammern',
  'heul doch',
  'uebertreib nicht',
  'ist doch nicht so schlimm',
  'so schlimm ist das nicht',
  'das bildest du dir ein',
  'du bist erbaermlich',
  'laecherlich',
  'mimimi',
  'werd endlich erwachsen',
  'tu nid so',
]

export function detectDerogation(text: string): boolean {
  const hay = normalize(text)
  return PHRASES.some((p) => hay.includes(normalize(p)))
}

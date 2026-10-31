import { detectPii } from './pii'

/**
 * Anzeigenamen erscheinen neben Gedanken und Antworten. Sie dürfen niemanden erkennbar machen (Telefon, E-Mail,
 * @Profil, Adresse, Link) und keine Autorität vortäuschen («Moderation», «Lichtung-Team» …) – in einem
 * pseudonymen Raum wäre beides ein naheliegender Missbrauch.
 */
const OFFICIAL = /\b(lichtung|moderat\w*|admin\w*|team|support|offiziell\w*|official|staff|mod)\b/i

export type DisplayNameProblem = 'personal' | 'official'

export function displayNameProblem(name: string): DisplayNameProblem | null {
  // Ziffernfolgen auch mit Leerzeichen dazwischen – «0 7 9 1 2 3 …» ist auch eine Telefonnummer.
  const digits = name.replace(/\D/g, '')
  if (detectPii(name).length || digits.length >= 6) return 'personal'
  if (OFFICIAL.test(name.normalize('NFKD').replace(/[̀-ͯ]/g, ''))) return 'official'
  return null
}

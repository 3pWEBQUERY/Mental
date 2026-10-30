import 'server-only'
import { randomInt } from 'node:crypto'
import { WORDS } from '../auth/wordlist'

export function generateRecoveryKey(): string[] {
  return Array.from({ length: 12 }, () => WORDS[randomInt(WORDS.length)]!)
}

/** Gross/klein, Umlaute, Bindestriche und Mehrfach-Leerzeichen sind egal. */
export function normalizeRecoveryKey(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/[^a-z]+/g, ' ')
    .trim()
}

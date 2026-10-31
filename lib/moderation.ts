import { detectCrisis, maxLevel, type CrisisLevel, type CrisisTerm } from './crisis'
import { detectPii } from './pii'
import { normalize } from './text'
import { safeMessage } from './log-safe'

export type ModerationFlag = 'hate' | 'harassment' | 'spam' | 'sexual' | 'personal_data'
export type Classification = { crisis: CrisisLevel; flags: ModerationFlag[] }

const HATE = ['scheiss auslaender', 'untermensch', 'vergasen', 'judensau', 'kanake', 'schwuchtel']
const HARASS = ['bring dich doch um', 'bring dich um', 'du bist wertlos', 'niemand mag dich', 'verpiss dich', 'halts maul', 'fresse']
const SEXUAL = ['nacktbild', 'nudes', 'sex treffen', 'onlyfans', 'sexting']

function localFlags(text: string): ModerationFlag[] {
  const hay = normalize(text)
  const flags = new Set<ModerationFlag>()
  const has = (list: string[]) => list.some((p) => hay.includes(normalize(p)))
  if (has(HATE)) flags.add('hate')
  if (has(HARASS)) flags.add('harassment')
  if (has(SEXUAL)) flags.add('sexual')
  if (detectPii(text).length) flags.add('personal_data')
  const links = text.match(/https?:\/\/|www\./gi)?.length ?? 0
  if (links >= 2 || /(.)\1{9,}/.test(text) || /\b(rabatt|gratis|gewinnspiel|crypto|bitcoin|promo ?code)\b/i.test(text)) flags.add('spam')
  return [...flags]
}

/**
 * Stufe 2 der Krisenerkennung. Version 1 läuft immer lokal (Wortliste + Heuristik) und
 * fragt zusätzlich einen externen Anbieter mit Datenverarbeitung in EU/CH, wenn MODERATION_API_URL gesetzt ist.
 * An den Anbieter geht nur der Text – keine Konto- oder Pseudonym-ID.
 *
 * Erwartetes Format: POST { text, language } → { crisis: 'none'|'concern'|'acute', flags: string[] }
 */
export async function classify(text: string, terms: readonly CrisisTerm[]): Promise<Classification> {
  const local: Classification = { crisis: detectCrisis(text, terms), flags: localFlags(text) }
  const url = process.env.MODERATION_API_URL
  if (!url) return local
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.MODERATION_API_KEY ?? ''}` },
      body: JSON.stringify({ text, language: 'de' }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const remote = (await res.json()) as Partial<Classification>
    const crisis = remote.crisis === 'acute' || remote.crisis === 'concern' ? remote.crisis : 'none'
    const allowed: ModerationFlag[] = ['hate', 'harassment', 'spam', 'sexual', 'personal_data']
    const flags = (remote.flags ?? []).filter((f): f is ModerationFlag => allowed.includes(f as ModerationFlag))
    return { crisis: maxLevel(local.crisis, crisis), flags: [...new Set([...local.flags, ...flags])] }
  } catch (e) {
    console.error('[moderation] Anbieter nicht erreichbar, lokale Einstufung gilt:', safeMessage(e))
    return local
  }
}

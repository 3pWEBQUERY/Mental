import { normalize } from './text'

/**
 * Typische Ratschlag-Anfänge. Wer «Zuhören» oder «Einfach raus damit» wählt, möchte gehört werden,
 * nicht repariert. Der Hinweis erscheint vor dem Senden und blockiert nicht.
 */
const PATTERNS = [
  /\bdu solltest\b/,
  /\bdu musst\b/,
  /\bdu muesstest\b/,
  /\bprobier(e|s)? (es )?(doch |mal )/,
  /\bversuch(e|s)? (es )?(doch |mal )/,
  /\ban deiner stelle\b/,
  /\bwarum (machst|tust|gehst|redest) du (nicht|kein)/,
  /\bhast du schon (mal )?(versucht|probiert)\b/,
  /\bmach (doch )?(einfach|mal)\b/,
]

export function detectAdvice(text: string): boolean {
  const hay = normalize(text)
  return PATTERNS.some((p) => p.test(hay))
}

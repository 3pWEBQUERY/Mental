export type PiiKind = 'phone' | 'email' | 'handle' | 'address' | 'url'
export type PiiMatch = { kind: PiiKind; start: number; end: number; text: string }

const PATTERNS: { kind: PiiKind; re: RegExp }[] = [
  { kind: 'email', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
  { kind: 'url', re: /\b(?:https?:\/\/|www\.)\S+/gi },
  // +41 79 123 45 67 · 079 123 45 67 · 0791234567 · 0041 …
  { kind: 'phone', re: /(?:\+|00)\d{2}[\s./-]?(?:\(0\))?\d{1,3}(?:[\s./-]?\d{2,4}){2,4}|\b0\d{1,3}(?:[\s./-]?\d{2,4}){2,4}\b/g },
  // @name auf Instagram, TikTok …  – kein E-Mail-Teil
  { kind: 'handle', re: /(?<![\w.])@[A-Za-z0-9_.]{2,30}\b/g },
  // Bahnhofstrasse 12 · Rue de Lausanne 4 · Musterweg 3a · 8004 Zürich
  {
    kind: 'address',
    re: /\b[A-ZÄÖÜ][a-zäöüé]+(?:strasse|straße|str\.|gasse|weg|platz|allee|ring|rain|halde)\s+\d{1,4}[a-z]?\b|\b(?:rue|avenue|chemin|via)\s+[\wÀ-ÿ' -]{2,30}\s+\d{1,4}\b|\b[1-9]\d{3}\s+[A-ZÄÖÜ][a-zäöüé]{2,}\b/g,
  },
]

/** Findet Angaben, die eine Person erkennbar machen könnten. Überlappungen werden zusammengeführt. */
export function detectPii(text: string): PiiMatch[] {
  const found: PiiMatch[] = []
  for (const { kind, re } of PATTERNS) {
    re.lastIndex = 0
    for (const m of text.matchAll(re)) {
      const start = m.index ?? 0
      const value = m[0].replace(/[.,;:!?)]+$/, '')
      if (kind === 'phone' && value.replace(/\D/g, '').length < 9) continue
      found.push({ kind, start, end: start + value.length, text: value })
    }
  }
  found.sort((a, b) => a.start - b.start || b.end - a.end)
  const merged: PiiMatch[] = []
  for (const f of found) {
    const last = merged[merged.length - 1]
    if (last && f.start < last.end) continue
    merged.push(f)
  }
  return merged
}

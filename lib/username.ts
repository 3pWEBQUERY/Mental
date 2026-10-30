export const USERNAME_RE = /^[a-z0-9_.]{3,24}$/

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase()
}

export function isValidUsername(u: string): boolean {
  return USERNAME_RE.test(u) && !/^[._]|[._]$/.test(u) && !/[._]{2}/.test(u)
}

const ADJ = [
  'stiller', 'sanfter', 'leiser', 'warmer', 'heller', 'ruhiger', 'weicher', 'klarer', 'wacher', 'freier',
  'stille', 'sanfte', 'leise', 'warme', 'helle', 'ruhige', 'weiche', 'klare', 'wache', 'freie',
]
const NOUN_M = ['ahorn', 'fluss', 'nebel', 'mond', 'stein', 'wind', 'farn', 'see', 'pfad', 'regen', 'tau', 'moos', 'fink', 'luchs']
const NOUN_F = ['birke', 'welle', 'wiese', 'linde', 'quelle', 'lerche', 'eule', 'weide', 'buche', 'distel', 'flocke', 'meise']

function pick<T>(arr: readonly T[], r: () => number): T {
  return arr[Math.floor(r() * arr.length)]!
}

/** Zufällige, nicht rückführbare Vorschläge wie «stiller.ahorn» oder «moos_42». */
export function suggestUsername(r: () => number = Math.random): string {
  const style = r()
  if (style < 0.6) {
    const masc = r() < 0.5
    const adj = pick(ADJ.slice(masc ? 0 : 10, masc ? 10 : 20), r)
    return `${adj}.${pick(masc ? NOUN_M : NOUN_F, r)}`
  }
  const noun = pick([...NOUN_M, ...NOUN_F], r)
  return `${noun}_${10 + Math.floor(r() * 90)}`
}

/** Häufige Vornamen in der Deutschschweiz – nur für den sanften Klarnamen-Hinweis. */
const FIRST_NAMES = new Set(
  (
    'anna lea laura sara sarah lena julia lara nina mia emma lina elena sophie sofia hannah hanna noemi alina ' +
    'jana chiara selina vanessa jasmin nadine sandra andrea claudia nicole daniela barbara monika ursula ruth ' +
    'maria marie elif mira noa lisa katharina eva petra franziska michelle jessica tamara melanie ' +
    'luca noah leon liam elias david samuel jonas lukas luis levin nico nicolas simon tim jan ' +
    'daniel michael thomas peter andreas christian martin marco stefan markus patrick reto beat urs ' +
    'hans fabian florian kevin dominik pascal raphael benjamin matthias tobias philipp sebastian samir ' +
    'adrian roman sandro silvan joel yannick manuel alexander mario mehmet ali ahmed'
  ).split(' '),
)

/** true, wenn der Name nach «Vorname.Nachname» aussieht. */
export function looksLikeRealName(u: string): boolean {
  const parts = u.split(/[._]/)
  if (parts.length === 2) {
    const [first, last] = parts as [string, string]
    return FIRST_NAMES.has(first) && /^[a-z]{2,}$/.test(last)
  }
  if (parts.length === 1) {
    for (const name of FIRST_NAMES) {
      if (u.startsWith(name) && /^[a-z]{4,}$/.test(u.slice(name.length))) return true
    }
  }
  return false
}

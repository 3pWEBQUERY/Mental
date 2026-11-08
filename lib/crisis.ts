import { foldUmlauts, normalize } from './text'

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
  // Wortanfänge (*): Zusammensetzungen wie «Suizidgedanken», «suizidal», «Selbstmordgedanken», «lebensmüder».
  { term: 'suizid*', level: 'acute' },
  { term: 'selbstmord*', level: 'acute' },
  { term: 'lebensmued*', level: 'acute' },
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
  { term: 'selbstverletz*', level: 'concern' },
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

/**
 * Französische Startliste (Romandie). Gilt in jeder Sprache der Oberfläche – wer in der deutschen App auf
 * Französisch schreibt, bekommt denselben Hinweis. Akzente und Apostrophe spielen keine Rolle (normalize).
 * Bewusst eng gefasst («je vais me tuer» statt «me tuer», sonst träfe «tu vas me tuer de rire»). Verglichen werden
 * ganze Wörter – «desespere» trifft also nicht «désespérément», braucht aber für «désespérée» einen eigenen Eintrag.
 * Wie die deutsche Liste vor dem Launch von einer Fachperson abzunehmen (docs/i18n/fr-pruefung.md).
 */
export const DEFAULT_CRISIS_TERMS_FR: CrisisTerm[] = [
  { term: 'envie de mourir', level: 'acute' },
  { term: 'veux mourir', level: 'acute' },
  { term: 'voudrais mourir', level: 'acute' },
  { term: 'veux plus vivre', level: 'acute' },
  { term: 'plus envie de vivre', level: 'acute' },
  { term: 'marre de vivre', level: 'acute' },
  { term: 'je vais me tuer', level: 'acute' },
  { term: 'envie de me tuer', level: 'acute' },
  { term: 'me suicider', level: 'acute' },
  { term: 'suicidaire', level: 'acute' },
  { term: 'suicidaires', level: 'acute' },
  { term: 'suicid*', level: 'acute' },
  { term: 'mettre fin a mes jours', level: 'acute' },
  { term: 'mettre fin a ma vie', level: 'acute' },
  { term: 'en finir avec la vie', level: 'acute' },
  { term: 'je veux en finir', level: 'acute' },
  { term: 'envie d en finir', level: 'acute' },
  { term: 'plus me reveiller', level: 'acute' },
  { term: 'lettre d adieu', level: 'acute' },
  { term: 'sauter du pont', level: 'acute' },
  { term: 'me jeter du pont', level: 'acute' },
  { term: 'me faire du mal', level: 'concern' },
  { term: 'me scarifier', level: 'concern' },
  { term: 'scarification', level: 'concern' },
  { term: 'automutilation', level: 'concern' },
  { term: 'plus aucun sens', level: 'concern' },
  { term: 'ma vie n a plus de sens', level: 'concern' },
  { term: 'sans espoir', level: 'concern' },
  // Ganze Wörter (normalize): die weibliche Form braucht einen eigenen Eintrag.
  { term: 'suis desespere', level: 'concern' },
  { term: 'suis desesperee', level: 'concern' },
  { term: 'sens desespere', level: 'concern' },
  { term: 'sens desesperee', level: 'concern' },
  { term: 'personne ne me regretterait', level: 'concern' },
  { term: 'mieux sans moi', level: 'concern' },
  { term: 'je suis un fardeau', level: 'concern' },
  { term: 'je n en peux plus', level: 'concern' },
  { term: 'veux disparaitre', level: 'concern' },
  { term: 'envie de disparaitre', level: 'concern' },
]

/**
 * Italienische Startliste (Tessin). Wie die französische eng gefasst und in jeder Oberflächen-Sprache gültig.
 * «Akut» stellt einen Gedanken bis zur Prüfung zurück – darum keine Redewendungen wie «farla finita» allein
 * («farla finita con questa storia»), sondern «voglio farla finita». Vor dem Launch von einer Fachperson
 * abzunehmen (docs/i18n/it-pruefung.md).
 */
export const DEFAULT_CRISIS_TERMS_IT: CrisisTerm[] = [
  { term: 'voglio morire', level: 'acute' },
  { term: 'vorrei morire', level: 'acute' },
  { term: 'voglia di morire', level: 'acute' },
  { term: 'non voglio piu vivere', level: 'acute' },
  { term: 'non ho piu voglia di vivere', level: 'acute' },
  { term: 'stanco di vivere', level: 'acute' },
  { term: 'stanca di vivere', level: 'acute' },
  { term: 'voglio farla finita', level: 'acute' },
  { term: 'farla finita con la vita', level: 'acute' },
  { term: 'togliermi la vita', level: 'acute' },
  { term: 'suicidarmi', level: 'acute' },
  { term: 'suicidio', level: 'acute' },
  { term: 'pensieri suicidi', level: 'acute' },
  { term: 'suicid*', level: 'acute' },
  { term: 'voglio uccidermi', level: 'acute' },
  { term: 'voglio ammazzarmi', level: 'acute' },
  { term: 'non svegliarmi piu', level: 'acute' },
  { term: 'lettera di addio', level: 'acute' },
  { term: 'buttarmi dal ponte', level: 'acute' },
  { term: 'farmi del male', level: 'concern' },
  { term: 'ferirmi', level: 'concern' },
  { term: 'autolesionismo', level: 'concern' },
  { term: 'niente ha piu senso', level: 'concern' },
  { term: 'la mia vita non ha senso', level: 'concern' },
  { term: 'senza speranza', level: 'concern' },
  { term: 'sono disperato', level: 'concern' },
  { term: 'sono disperata', level: 'concern' },
  { term: 'mi sento disperato', level: 'concern' },
  { term: 'mi sento disperata', level: 'concern' },
  { term: 'nessuno sentirebbe la mia mancanza', level: 'concern' },
  { term: 'meglio senza di me', level: 'concern' },
  { term: 'sono un peso', level: 'concern' },
  { term: 'non ce la faccio piu', level: 'concern' },
  { term: 'voglio sparire', level: 'concern' },
  { term: 'vorrei sparire', level: 'concern' },
]

/**
 * Englische Startliste. Wie die französische und italienische eng gefasst («akut» hält einen Gedanken bis zur
 * Prüfung zurück): ganze Wendungen statt einzelner Wörter wie «die» oder «end it» («end it with him»). Apostrophe werden beim
 * Vergleich zu Leerzeichen (lib/text.ts) – darum je eine Fassung mit und ohne («don’t» / «dont»).
 * Vor dem Launch von einer Fachperson abzunehmen.
 */
export const DEFAULT_CRISIS_TERMS_EN: CrisisTerm[] = [
  { term: 'i want to die', level: 'acute' },
  { term: 'i wanna die', level: 'acute' },
  { term: 'want to be dead', level: 'acute' },
  { term: 'wish i was dead', level: 'acute' },
  { term: 'wish i were dead', level: 'acute' },
  { term: 'don’t want to live', level: 'acute' },
  { term: 'dont want to live', level: 'acute' },
  { term: 'do not want to live', level: 'acute' },
  { term: 'don’t want to be alive', level: 'acute' },
  { term: 'dont want to be alive', level: 'acute' },
  { term: 'no reason to live', level: 'acute' },
  { term: 'kill myself', level: 'acute' },
  { term: 'killing myself', level: 'acute' },
  { term: 'end my life', level: 'acute' },
  { term: 'ending my life', level: 'acute' },
  { term: 'take my own life', level: 'acute' },
  { term: 'want to end it all', level: 'acute' },
  { term: 'suicide', level: 'acute' },
  { term: 'suicid*', level: 'acute' },
  { term: 'goodbye letter', level: 'acute' },
  { term: 'never wake up', level: 'acute' },
  { term: 'jump off a bridge', level: 'acute' },
  { term: 'hurt myself', level: 'concern' },
  { term: 'harm myself', level: 'concern' },
  { term: 'self harm', level: 'concern' },
  { term: 'cutting myself', level: 'concern' },
  { term: 'nothing makes sense anymore', level: 'concern' },
  { term: 'hopeless', level: 'concern' },
  { term: 'no hope left', level: 'concern' },
  { term: 'nobody would miss me', level: 'concern' },
  { term: 'no one would miss me', level: 'concern' },
  { term: 'better off without me', level: 'concern' },
  { term: 'i am a burden', level: 'concern' },
  { term: 'i’m a burden', level: 'concern' },
  { term: 'im a burden', level: 'concern' },
  { term: 'i can’t go on', level: 'concern' },
  { term: 'i cant go on', level: 'concern' },
  { term: 'i can’t do this anymore', level: 'concern' },
  { term: 'i cant do this anymore', level: 'concern' },
  { term: 'overdose', level: 'concern' },
  { term: 'want to disappear', level: 'concern' },
]

/** Rückfall ohne Datenbank: alle Sprachen. */
export const ALL_DEFAULT_CRISIS_TERMS: CrisisTerm[] = [...DEFAULT_CRISIS_TERMS, ...DEFAULT_CRISIS_TERMS_FR, ...DEFAULT_CRISIS_TERMS_IT, ...DEFAULT_CRISIS_TERMS_EN]

const RANK: Record<CrisisLevel, number> = { none: 0, concern: 1, acute: 2 }

/** Stufe 1: läuft beim Tippen im Browser. Blockiert nie, zeigt nur einen ruhigen Hinweis. */
/**
 * Ganze Wörter («suizid» trifft nicht «suizidal»). Mit * am Ende ein Wortanfang: «suizid*» trifft «Suizidgedanken»,
 * «suizidal» – nötig für deutsche Zusammensetzungen.
 */
function needleOf(term: string) {
  const prefix = term.trim().endsWith('*')
  const n = normalize(prefix ? term.trim().slice(0, -1) : term)
  return prefix ? n.trimEnd() : n
}

export function detectCrisis(text: string, terms: readonly CrisisTerm[] = ALL_DEFAULT_CRISIS_TERMS): CrisisLevel {
  if (!text.trim()) return 'none'
  const hay = normalize(text)
  // Zweite Fassung ohne Umlaut-Schreibweisen: «lebensmude», «mochte sterben», «brucke».
  const folded = foldUmlauts(hay)
  let level: CrisisLevel = 'none'
  for (const t of terms) {
    const needle = needleOf(t.term)
    if (needle.trim() && (hay.includes(needle) || folded.includes(foldUmlauts(needle))) && RANK[t.level] > RANK[level]) {
      level = t.level
      if (level === 'acute') break
    }
  }
  return level
}

export function maxLevel(a: CrisisLevel, b: CrisisLevel): CrisisLevel {
  return RANK[a] >= RANK[b] ? a : b
}

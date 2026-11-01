export type HelpResource = {
  name: string
  phone: string | null
  url: string | null
  hours: string
  audience: string
}

/** Fallback, falls die Datenbank nicht erreichbar ist. Gepflegt wird die Liste im Admin-Bereich. */
export const DEFAULT_HELP: HelpResource[] = [
  { name: 'Die Dargebotene Hand', phone: '143', url: 'https://www.143.ch', hours: 'rund um die Uhr', audience: 'anonym, für alle' },
  { name: 'Pro Juventute', phone: '147', url: 'https://www.147.ch', hours: 'rund um die Uhr', audience: 'für Kinder & Jugendliche' },
  { name: 'Notruf', phone: '144', url: null, hours: 'rund um die Uhr', audience: 'bei akuter Gefahr' },
]

/** Französische Fassung für /aide (Romandie). Gleiche Nummern, Namen und Angaben der Stellen auf Französisch. */
export const DEFAULT_HELP_FR: HelpResource[] = [
  { name: 'La Main Tendue', phone: '143', url: 'https://www.143.ch', hours: '24 h sur 24', audience: 'anonyme, pour toutes et tous' },
  { name: 'Pro Juventute', phone: '147', url: 'https://www.147.ch', hours: '24 h sur 24', audience: 'pour les enfants et les jeunes' },
  { name: 'Urgences sanitaires', phone: '144', url: null, hours: '24 h sur 24', audience: 'en cas de danger immédiat' },
]

/** Italienische Fassung für /aiuto (Tessin, italienischsprachige Bündner Täler). */
export const DEFAULT_HELP_IT: HelpResource[] = [
  { name: 'Telefono Amico', phone: '143', url: 'https://www.143.ch', hours: '24 ore su 24', audience: 'anonimo, per tutte e tutti' },
  { name: 'Pro Juventute', phone: '147', url: 'https://www.147.ch', hours: '24 ore su 24', audience: 'per bambini e giovani' },
  { name: 'Emergenza sanitaria', phone: '144', url: null, hours: '24 ore su 24', audience: 'in caso di pericolo immediato' },
]

export type HelpLanguage = 'de' | 'fr' | 'it'
export const defaultHelp = (language: HelpLanguage) => (language === 'fr' ? DEFAULT_HELP_FR : language === 'it' ? DEFAULT_HELP_IT : DEFAULT_HELP)

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

export type HelpLanguage = 'de' | 'fr'
export const defaultHelp = (language: HelpLanguage) => (language === 'fr' ? DEFAULT_HELP_FR : DEFAULT_HELP)

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

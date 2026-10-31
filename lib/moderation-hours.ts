/**
 * Wann das Moderationsteam erreichbar ist (Schweizer Zeit). Ohne Nachtbereitschaft gilt: nachts keine
 * Krisen-Pushes an das Team (sie würden nur zermürben, niemand kann reagieren) – dafür sagt die App ehrlich,
 * dass gerade niemand da ist, und verweist auf 143/144. Mit Bereitschaft: NIGHT_MODERATION=1 am web- und
 * worker-Service sowie am monitor.
 * Bewusst ohne «server-only»: läuft in der App, im Browser, im Worker und im Monitor.
 */
export const MODERATION_HOURS = { from: 7, to: 22 } as const

export function zurichHour(d = new Date()) {
  // formatToParts statt format: je nach Sprache steht «22 Uhr» o. Ä. da, die Stunde allein ist eindeutig.
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Zurich', hour: '2-digit', hourCycle: 'h23' }).formatToParts(d)
  return Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
}

/** true, wenn gerade niemand aus dem Team erreichbar ist. */
export function moderationAway(nightStaffed: boolean, d = new Date()) {
  if (nightStaffed) return false
  const h = zurichHour(d)
  return h < MODERATION_HOURS.from || h >= MODERATION_HOURS.to
}

/** Serverseitig: gibt es eine Nachtbereitschaft? */
export function nightStaffed() {
  return process.env.NIGHT_MODERATION === '1'
}

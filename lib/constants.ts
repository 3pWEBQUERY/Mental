/** Fachliche Konstanten, die Server und Browser teilen. Keine Geheimnisse. */

export const MOODS = [
  { key: 'heavy', token: '--mood-0', amp: 0.3, speed: 0.55 },
  { key: 'tired', token: '--mood-1', amp: 0.22, speed: 0.7 },
  { key: 'okay', token: '--mood-2', amp: 0.15, speed: 1.0 },
  { key: 'lighter', token: '--mood-3', amp: 0.12, speed: 1.15 },
  { key: 'good', token: '--mood-4', amp: 0.1, speed: 1.3 },
] as const
export type MoodIndex = 0 | 1 | 2 | 3 | 4
export const MOOD_HEAVY = 0

export const NEEDS = ['listen', 'courage', 'advice', 'vent', 'brave'] as const
export type Need = (typeof NEEDS)[number]
/** Bei diesen Bedürfnissen wünscht sich die Person keine Ratschläge. */
export const NO_ADVICE_NEEDS: readonly Need[] = ['listen', 'vent']

export const SUPPORT_KINDS = ['hear', 'same', 'strong'] as const
export type SupportKind = (typeof SUPPORT_KINDS)[number]

export const VISIBILITIES = ['anonymous', 'pseudonym'] as const
export type Visibility = (typeof VISIBILITIES)[number]

export const REPORT_REASONS = ['worry', 'hurtful', 'spam', 'personal_data', 'other'] as const
export type ReportReason = (typeof REPORT_REASONS)[number]

export const LIMITS = {
  postMin: 3,
  postMax: 600,
  replyMax: 400,
  noteMax: 280,
  journalMax: 5000,
  displayNameMax: 32,
  editWindowMs: 15 * 60 * 1000,
  postsPerDay: 10,
  postsPerDayNew: 3,
  repliesPerDayNew: 10,
  repliesPerDay: 120,
  newAccountMs: 24 * 60 * 60 * 1000,
  feedPageSize: 20,
  feedDailyCap: 60,
  unheardMaxAgeMs: 72 * 60 * 60 * 1000,
  imageMaxBytes: 10 * 1024 * 1024,
  imageMaxPx: 2048,
} as const

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'] as const

export const BREATH = { inhale: 4, hold: 2, exhale: 6, cycles: 5 } as const

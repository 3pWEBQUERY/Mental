import { localeTag, m } from '@/messages'

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

export const TZ = 'Europe/Zurich'

/** «vor 12 Min.», «gestern» – bewusst grob, damit nichts nach Uhr-Kontrolle aussieht. */
export function relativeTime(iso: string | Date, now: number = Date.now()): string {
  const t = typeof iso === 'string' ? Date.parse(iso) : iso.getTime()
  const diff = Math.max(0, now - t)
  const tm = m.feed.time
  if (diff < 2 * MIN) return tm.now
  if (diff < HOUR) return tm.minutes(Math.floor(diff / MIN))
  if (diff < 20 * HOUR) return tm.hours(Math.floor(diff / HOUR))
  const days = dayIndex(now) - dayIndex(t)
  if (days <= 1) return tm.yesterday
  return tm.days(days)
}

function dayIndex(ms: number) {
  const d = new Date(ms)
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
  return Math.floor(Date.parse(`${parts}T00:00:00Z`) / DAY)
}

/** YYYY-MM-DD in Schweizer Zeit. */
export function zurichDay(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

export function zurichHour(d: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' }).format(d))
}

export function formatDate(d: Date | string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }) {
  return new Intl.DateTimeFormat(localeTag(), { timeZone: TZ, ...opts }).format(typeof d === 'string' ? new Date(d) : d)
}

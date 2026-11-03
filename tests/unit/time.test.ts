import { expect, test } from 'vitest'
import { relativeTime } from '@/lib/time'

// Zeiten in Schweizer Winterzeit (UTC+1).
const at = (s: string) => Date.parse(`${s}+01:00`)

test('relativeTime: gleicher Kalendertag bleibt «vor … Std.», erst der Vortag heisst «gestern»', () => {
  expect(relativeTime(new Date(at('2026-11-03T00:30:00')), at('2026-11-03T21:00:00'))).toBe('vor 20 Std.')
  expect(relativeTime(new Date(at('2026-11-02T23:30:00')), at('2026-11-03T21:00:00'))).toBe('gestern')
  expect(relativeTime(new Date(at('2026-11-01T12:00:00')), at('2026-11-03T21:00:00'))).toMatch(/2/)
  expect(relativeTime(new Date(at('2026-11-03T20:59:30')), at('2026-11-03T21:00:00'))).toBe('gerade eben')
})

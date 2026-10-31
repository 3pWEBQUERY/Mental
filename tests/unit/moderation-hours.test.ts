import { describe, expect, it } from 'vitest'
import { moderationAway, zurichHour } from '@/lib/moderation-hours'

describe('moderationAway', () => {
  it('rechnet in Schweizer Zeit, auch über die Sommerzeit', () => {
    expect(zurichHour(new Date('2026-07-01T20:30:00Z'))).toBe(22) // MESZ = UTC+2
    expect(zurichHour(new Date('2026-12-01T20:30:00Z'))).toBe(21) // MEZ = UTC+1
  })
  it('nachts weg, tagsüber da', () => {
    expect(moderationAway(false, new Date('2026-12-01T22:00:00Z'))).toBe(true) // 23 Uhr
    expect(moderationAway(false, new Date('2026-12-01T05:30:00Z'))).toBe(true) // 6:30
    expect(moderationAway(false, new Date('2026-12-01T06:00:00Z'))).toBe(false) // 7 Uhr
    expect(moderationAway(false, new Date('2026-12-01T20:59:00Z'))).toBe(false) // 21:59
  })
  it('mit Nachtbereitschaft nie weg', () => {
    expect(moderationAway(true, new Date('2026-12-01T02:00:00Z'))).toBe(false)
  })
})

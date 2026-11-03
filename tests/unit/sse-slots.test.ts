import { expect, test, vi } from 'vitest'

vi.mock('server-only', () => ({}))

test('SSE: höchstens 4 je Konto (älteste wird verdrängt), Freigabe zählt richtig', async () => {
  const { openConnections, takeSlot } = await import('@/lib/server/sse-slots')
  const closed: number[] = []
  const releases = [0, 1, 2, 3, 4, 5].map((i) => takeSlot('a', () => closed.push(i)))
  expect(closed).toEqual([0, 1])
  expect(openConnections()).toBe(4)
  releases[0]!() // schon verdrängt – zählt nicht doppelt
  releases[5]!()
  releases[5]!()
  expect(openConnections()).toBe(3)
  const other = takeSlot('b', () => {})
  expect(openConnections()).toBe(4)
  for (const r of [...releases, other]) r?.()
  expect(openConnections()).toBe(0)
})

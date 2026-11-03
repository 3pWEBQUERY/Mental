import { expect, test } from 'vitest'
import { breathAt, breathPlan } from '@/lib/breath'

test('Atemmuster: Runden passend zur Dauer, Phasen in der richtigen Reihenfolge', () => {
  expect(breathPlan('calm', 1)).toMatchObject({ cycle: 12, cycles: 5, total: 60 })
  expect(breathPlan('box', 3)).toMatchObject({ cycle: 16, cycles: 11, total: 176 })
  expect(breathPlan('relax', 5)).toMatchObject({ cycle: 19, cycles: 16, total: 304 })
  const box = breathPlan('box', 1)
  expect([1, 5, 9, 13].map((t) => breathAt(box, t)!.phase)).toEqual(['inhale', 'hold', 'exhale', 'rest'])
  expect(breathAt(box, 6)!.level).toBe(1)
  expect(breathAt(box, 14)!.level).toBe(0)
  const relax = breathPlan('relax', 1)
  expect(breathAt(relax, 4.5)!.phase).toBe('hold')
  expect(breathAt(relax, 10.9)!.phase).toBe('hold')
  expect(breathAt(relax, 11.1)!.phase).toBe('exhale')
  expect(breathAt(relax, relax.total)).toBeNull()
  expect(breathAt(relax, 0)!.left).toBe(relax.total)
})

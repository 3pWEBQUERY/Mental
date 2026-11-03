import { expect, test } from 'vitest'

test('Mitglieds-Token: Konto-ID nicht lesbar, fälschungssicher, an den Zweck gebunden', async () => {
  process.env.SESSION_SECRET ??= 'test-secret-0123456789abcdef0123456789abcdef'
  const { encSeal, encUnseal } = await import('@/lib/server/crypto')
  const id = '0190f3a2-1111-7aaa-8bbb-123456789abc'
  const t = encSeal(id, 60_000, 'member-page')
  expect(Buffer.from(t, 'base64url').toString('latin1')).not.toContain(id)
  expect(t).not.toContain(id.slice(0, 8))
  expect(encUnseal<string>(t, 'member-page')).toBe(id)
  expect(encUnseal<string>(t, 'anderer-zweck')).toBeNull()
  const flipped = t.slice(0, -2) + (t.at(-2) === 'A' ? 'B' : 'A') + t.at(-1)
  expect(encUnseal<string>(flipped, 'member-page')).toBeNull()
  expect(encUnseal<string>(encSeal(id, -1, 'member-page'), 'member-page')).toBeNull()
  expect(encUnseal<string>('kaputt', 'member-page')).toBeNull()
})

import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { strFromU8, strToU8, unzipSync } from 'fflate'
import { afterAll, expect, test } from 'vitest'
import { writeZip } from '@/lib/zip-file'

let dir = ''
afterAll(() => rm(dir, { recursive: true, force: true }))

test('writeZip: gestreamtes ZIP mit komprimierten und unveränderten Dateien', async () => {
  dir = await mkdtemp(join(tmpdir(), 'zip-test-'))
  const path = join(dir, 'a.zip')
  const big = new Uint8Array(3 * 1024 * 1024).map((_, i) => (i * 7) % 251)
  await writeZip(path, async (add) => {
    await add('jiaia.json', strToU8(JSON.stringify({ hallo: 'welt' })), true)
    for (let i = 0; i < 4; i++) await add(`bilder/${i}.webp`, big, false)
  })
  const files = unzipSync(new Uint8Array(await readFile(path)))
  expect(Object.keys(files).sort()).toEqual(['bilder/0.webp', 'bilder/1.webp', 'bilder/2.webp', 'bilder/3.webp', 'jiaia.json'])
  expect(JSON.parse(strFromU8(files['jiaia.json']!))).toEqual({ hallo: 'welt' })
  expect(files['bilder/3.webp']!.length).toBe(big.length)
  expect(files['bilder/2.webp']![12345]).toBe(big[12345])
})

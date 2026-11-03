import { once } from 'node:events'
import { createWriteStream } from 'node:fs'
import { Zip, ZipDeflate, ZipPassThrough } from 'fflate'

/** ZIP-Datei Stück für Stück schreiben (fflate-Streaming, mit Rückstau der Platte). */
export async function writeZip(path: string, fill: (add: (name: string, data: Uint8Array, compress: boolean) => Promise<void>) => Promise<void>) {
  const out = createWriteStream(path)
  let failed: Error | null = null
  const finished = new Promise<void>((resolve, reject) => {
    out.on('error', reject)
    out.on('finish', resolve)
  })
  const zip = new Zip((err, chunk, final) => {
    if (err) failed = err
    else out.write(chunk)
    if (final || err) out.end()
  })
  await fill(async (name, data, compress) => {
    if (failed) throw failed
    const file = compress ? new ZipDeflate(name, { level: 6 }) : new ZipPassThrough(name)
    zip.add(file)
    file.push(data, true)
    if (out.writableNeedDrain) await once(out, 'drain')
  })
  zip.end()
  await finished
  if (failed) throw failed
}

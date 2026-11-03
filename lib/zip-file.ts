import { createWriteStream } from 'node:fs'
import { Zip, ZipDeflate, ZipPassThrough } from 'fflate'

/**
 * ZIP-Datei Stück für Stück schreiben (fflate-Streaming, mit Rückstau der Platte). Ein Schreibfehler (z. B. Platte voll)
 * wird als Fehler zurückgegeben – nie als unbehandelte Promise-Ablehnung, die den ganzen Worker beenden würde.
 */
export async function writeZip(path: string, fill: (add: (name: string, data: Uint8Array, compress: boolean) => Promise<void>) => Promise<void>) {
  const out = createWriteStream(path)
  let failed: Error | null = null
  let drain: (() => void) | null = null
  out.on('error', (e) => {
    failed ??= e
    drain?.()
  })
  out.on('drain', () => drain?.())
  const finished = new Promise<void>((resolve) => {
    out.on('finish', resolve)
    out.on('close', resolve)
  })
  const zip = new Zip((err, chunk, final) => {
    if (err) failed ??= err
    else if (!failed) out.write(chunk)
    if (final || err) out.end()
  })
  try {
    await fill(async (name, data, compress) => {
      if (failed) throw failed
      const file = compress ? new ZipDeflate(name, { level: 6 }) : new ZipPassThrough(name)
      zip.add(file)
      file.push(data, true)
      if (out.writableNeedDrain && !failed) await new Promise<void>((r) => (drain = r))
      drain = null
      if (failed) throw failed
    })
    zip.end()
  } catch (e) {
    failed ??= e as Error
    out.destroy()
  }
  await finished
  if (failed) throw failed
}

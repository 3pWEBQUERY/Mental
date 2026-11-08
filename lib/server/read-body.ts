import 'server-only'

/**
 * Anfragekörper lesen, aber höchstens `max` Byte – auch ohne Content-Length (chunked). Sonst läse
 * request.text()/json() beliebig viel in den Speicher, bevor eine Grössenprüfung greift.
 * null = zu gross (oder abgebrochen).
 */
export async function readLimited(request: Request, max: number): Promise<string | null> {
  const declared = Number(request.headers.get('content-length') ?? NaN)
  if (Number.isFinite(declared) && declared > max) return null
  if (!request.body) return ''
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > max) {
        await reader.cancel().catch(() => {})
        return null
      }
      chunks.push(value)
    }
  } catch {
    return null
  }
  return new TextDecoder().decode(Buffer.concat(chunks))
}

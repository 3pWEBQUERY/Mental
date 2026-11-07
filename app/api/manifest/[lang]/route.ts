import { manifestFor } from '@/lib/manifest'
import { isLocale } from '@/messages'

/** Manifest in einer Sprache (siehe app/manifest.ts). Öffentlich und ohne Persönliches – darf gecacht werden. */
export async function GET(_: Request, { params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  if (!isLocale(lang)) return new Response('not found', { status: 404 })
  return Response.json(manifestFor(lang), {
    headers: { 'content-type': 'application/manifest+json', 'cache-control': 'public, max-age=3600' },
  })
}

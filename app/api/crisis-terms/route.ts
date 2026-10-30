import { getCrisisTerms } from '@/lib/server/terms'

/** Wortliste für die Krisenerkennung im Browser (Stufe 1), als statisches JSON. */
export async function GET() {
  return Response.json(await getCrisisTerms(), { headers: { 'Cache-Control': 'public, max-age=3600' } })
}

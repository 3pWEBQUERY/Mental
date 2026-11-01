import { connection } from 'next/server'

/**
 * Universal Links für die iOS-App: Ein Link auf einen Gedanken öffnet die App statt Safari.
 * APPLE_APP_ID = «<Team-ID>.<Bundle-ID>» (z. B. ABCDE12345.ch.lichtung.app). Ohne Variable: 404, nichts verknüpft.
 */
export async function GET() {
  await connection()
  const appID = process.env.APPLE_APP_ID?.trim()
  if (!appID || !/^[A-Z0-9]{10}\.[A-Za-z0-9.-]+$/.test(appID)) return new Response('Not found', { status: 404 })
  return Response.json(
    { applinks: { details: [{ appIDs: [appID], components: [{ '/': '/start/gedanke/*' }, { '/': '/lichtung/gedanke/*' }] }] } },
    { headers: { 'Cache-Control': 'public, max-age=3600' } },
  )
}

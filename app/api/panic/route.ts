import { destroySession } from '@/lib/server/session'

/** Wird per sendBeacon beim Schnell-Ausblenden aufgerufen – nur von der eigenen Seite (keine Abmeldung durch Fremde). */
export async function POST(request: Request) {
  const site = request.headers.get('sec-fetch-site')
  const origin = request.headers.get('origin')
  if ((site && site !== 'same-origin') || (origin !== null && !sameHost(origin, request.headers.get('host')))) return new Response(null, { status: 403 })
  await destroySession()
  return new Response(null, { status: 204 })
}

/** Origin «null» oder unlesbar zählt als fremd (403 statt Serverfehler). */
function sameHost(origin: string, host: string | null) {
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

import { destroySession } from '@/lib/server/session'
import { env } from '@/lib/server/env'

/**
 * Abmelden für den Knopf in der App (components/auth/logout-button.tsx). Eine Route statt einer Server Action:
 * Löscht eine Server Action das Sitzungs-Cookie, rendert Next die aktuelle Seite neu – die verlangt eine Sitzung und
 * leitete über /api/session/clear weiter. Danach lädt der Browser die Anmeldung selbst ganz neu.
 * Nur von dieser Seite (Origin bzw. Sec-Fetch-Site): Eine fremde Seite soll niemanden abmelden können.
 */
export async function POST(request: Request) {
  const site = request.headers.get('sec-fetch-site')
  const origin = request.headers.get('origin')
  const sameOrigin = site ? site === 'same-origin' : origin === new URL(env.appUrl).origin
  if (!sameOrigin) return new Response(null, { status: 403 })
  await destroySession()
  return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } })
}

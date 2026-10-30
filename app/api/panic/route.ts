import { destroySession } from '@/lib/server/session'

/** Wird per sendBeacon beim Schnell-Ausblenden aufgerufen. */
export async function POST() {
  await destroySession()
  return new Response(null, { status: 204 })
}

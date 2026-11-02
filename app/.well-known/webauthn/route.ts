import { connection } from 'next/server'
import { env } from '@/lib/server/env'

/**
 * WebAuthn «Related Origin Requests»: Browser rufen diese Datei auf der *früheren* Domain ab (z. B. der
 * Railway-Adresse), wenn jiaia.app einen dort angelegten Passkey verwenden will. Steht die aktuelle Adresse
 * darin, darf der alte Passkey hier weiter anmelden. proxy.ts leitet diesen Pfad darum nicht um.
 */
export async function GET() {
  await connection()
  return Response.json(
    { origins: [new URL(env.appUrl).origin] },
    { headers: { 'cache-control': 'public, max-age=3600', 'access-control-allow-origin': '*' } },
  )
}

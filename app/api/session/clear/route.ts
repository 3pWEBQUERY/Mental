import { NextResponse } from 'next/server'
import { env } from '@/lib/server/env'
import { getViewer, SESSION_COOKIE } from '@/lib/server/session'

/**
 * Entfernt ein abgelaufenes Sitzungs-Cookie und führt zur Anmeldung. Ist die Sitzung noch gültig, bleibt sie –
 * sonst könnte eine fremde Seite jemanden mit einem einfachen Link abmelden.
 * Ziel immer über APP_URL: request.url ist hinter dem Proxy von Railway die interne Adresse (localhost:8080).
 */
export async function GET() {
  if (await getViewer()) return NextResponse.redirect(new URL('/start', env.appUrl))
  const res = NextResponse.redirect(new URL('/anmelden', env.appUrl))
  res.cookies.delete(SESSION_COOKIE)
  return res
}

import { NextResponse, type NextRequest } from 'next/server'
import { getViewer, SESSION_COOKIE } from '@/lib/server/session'

/**
 * Entfernt ein abgelaufenes Sitzungs-Cookie und führt zur Anmeldung. Ist die Sitzung noch gültig, bleibt sie –
 * sonst könnte eine fremde Seite jemanden mit einem einfachen Link abmelden.
 */
export async function GET(request: NextRequest) {
  if (await getViewer()) return NextResponse.redirect(new URL('/start', request.url))
  const res = NextResponse.redirect(new URL('/anmelden', request.url))
  res.cookies.delete(SESSION_COOKIE)
  return res
}

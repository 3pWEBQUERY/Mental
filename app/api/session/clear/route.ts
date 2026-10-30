import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE } from '@/lib/server/session'

/** Entfernt ein abgelaufenes Sitzungs-Cookie und führt zur Anmeldung. */
export function GET(request: NextRequest) {
  const res = NextResponse.redirect(new URL('/anmelden', request.url))
  res.cookies.delete(SESSION_COOKIE)
  return res
}

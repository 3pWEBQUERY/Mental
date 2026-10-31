import { createHash } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { PREFS_SCRIPT } from './lib/prefs-script'

const SESSION_COOKIE = 'lichtung_session'
const PROTECTED = ['/lichtung', '/ich', '/einstellungen', '/admin']
const AUTH_ONLY = ['/anmelden', '/registrieren']
/** Vollständig vorgerenderte Seiten ohne Nutzerinhalte – hier kann es keine Nonce geben. */
const STATIC_PAGES = ['/hilfe', '/datenschutz', '/impressum', '/offline', '/aide']
/** Alle Seiten-Routen der App. Was hier nicht drin ist, endet auf der vorgerenderten 404-Seite. */
const APP_ROUTES = ['/', '/regeln', '/transparenz', ...STATIC_PAGES, ...PROTECTED, ...AUTH_ONLY, '/wiederherstellen', '/sprache']
const isAppRoute = (p: string) => APP_ROUTES.some((r) => p === r || (r !== '/' && p.startsWith(`${r}/`)))
/** Gleich wie LOCALE_COOKIE in messages/index.ts – hier ohne Import, damit die Wörterbücher nicht im Proxy landen. */
const LOCALE_COOKIE = 'lichtung_lang'

/** Erste Wahl aus Accept-Language: Französisch, wenn es vor Deutsch steht, sonst Deutsch. */
export function pickLocale(acceptLanguage: string | null): 'de' | 'fr' {
  const langs = (acceptLanguage ?? '')
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().toLowerCase().split(';')
      const q = Number(params.find((p) => p.trim().startsWith('q='))?.split('=')[1] ?? 1)
      return { tag: tag ?? '', q: Number.isFinite(q) ? q : 0 }
    })
    .filter((l) => l.tag)
    .sort((a, b) => b.q - a.q)
  for (const l of langs) {
    if (l.tag.startsWith('fr')) return 'fr'
    if (l.tag.startsWith('de')) return 'de'
  }
  return 'de'
}

const PREFS_HASH = `'sha256-${createHash('sha256').update(PREFS_SCRIPT).digest('base64')}'`

/**
 * Setzt die Content Security Policy (mit Nonce) und leitet nicht eingeloggte Besucher
 * von geschützten Routen auf /anmelden. Das ist nur Komfort – die eigentliche Prüfung
 * passiert in jeder Server Action und jedem Route Handler.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hasSession = request.cookies.has(SESSION_COOKIE)
  // Nur Seitenaufrufe umleiten – nie Server Actions (POST), sonst bricht z. B. der letzte Registrierungsschritt.
  const isPage = request.method === 'GET'

  if (isPage && !hasSession && PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const url = request.nextUrl.clone()
    url.pathname = '/anmelden'
    url.search = ''
    return NextResponse.redirect(url)
  }
  if (isPage && hasSession && (pathname === '/' || AUTH_ONLY.includes(pathname))) {
    const url = request.nextUrl.clone()
    url.pathname = '/lichtung'
    url.search = ''
    return NextResponse.redirect(url)
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const dev = process.env.NODE_ENV === 'development'
  // Statische Seiten: nur eigene Skripte und die von Next.js eingebetteten Inline-Skripte.
  // Dynamische Seiten (alles mit Sitzung oder Nutzerinhalten): strikte CSP mit Nonce.
  // Unbekannte Pfade landen auf der statischen 404-Seite (ohne Nutzerinhalte) – sonst blockierte die Nonce-CSP ihre Skripte.
  const scriptSrc = STATIC_PAGES.includes(pathname) || !isAppRoute(pathname)
    ? `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}`
    : `script-src 'self' 'nonce-${nonce}' ${PREFS_HASH} 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`
  const bucket = process.env.ENDPOINT ? new URL(process.env.ENDPOINT).origin : ''
  const csp = [
    `default-src 'self'`,
    scriptSrc,
    // style-Attribute (Kreisfarben, Bildgrössen) brauchen 'unsafe-inline' für Styles – nie für Skripte.
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' blob: data: ${bucket} https://*.storageapi.dev`,
    `font-src 'self'`,
    `connect-src 'self' ${bucket} https://*.storageapi.dev${dev ? ' ws:' : ''}`,
    `worker-src 'self'`,
    `manifest-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    process.env.APP_URL?.startsWith('https://') ? 'upgrade-insecure-requests' : '',
  ]
    .filter(Boolean)
    .join('; ')

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  // Erster Besuch ohne gewählte Sprache: aus dem Browser übernehmen – schon für diese Anfrage (Cookie-Header)
  // und dauerhaft (Antwort-Cookie). Gewechselt wird über /sprache oder die Einstellungen.
  const detected = isPage && !request.cookies.has(LOCALE_COOKIE) ? pickLocale(request.headers.get('accept-language')) : null
  if (detected) {
    const cookie = request.headers.get('cookie')
    requestHeaders.set('cookie', `${cookie ? `${cookie}; ` : ''}${LOCALE_COOKIE}=${detected}`)
  }
  requestHeaders.set('Content-Security-Policy', csp)
  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('Content-Security-Policy', csp)
  if (detected) response.cookies.set(LOCALE_COOKIE, detected, { path: '/', sameSite: 'lax', maxAge: 365 * 24 * 60 * 60, secure: process.env.NODE_ENV === 'production' })

  // Gleitende Sitzung: das Cookie lebt 30 Tage ab dem letzten Besuch.
  // Nur bei Seitenaufrufen: Ein Set-Cookie in der Antwort einer Server Action lässt Next.js die ganze Route neu rendern.
  const session = request.cookies.get(SESSION_COOKIE)
  if (session && isPage) {
    response.cookies.set(SESSION_COOKIE, session.value, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    })
  }
  return response
}

export const config = {
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|sw.js|icons/).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}

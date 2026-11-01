import { sql, eq } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { profiles } from '@/db/schema'
import { getViewer } from '@/lib/server/session'
import { env } from '@/lib/server/env'
import { isLocale, LOCALE_COOKIE } from '@/messages'

/** Die beiden Hilfeseiten sind vorgerendert und einsprachig – beim Wechsel auf die jeweils andere springen. */
const HELP_PAGE = { de: '/hilfe', fr: '/aide', it: '/aiuto' } as const

/**
 * Sprache wechseln: /sprache?l=fr&zurueck=/einstellungen. Setzt das Cookie für dieses Gerät, merkt es sich
 * bei Angemeldeten im Konto und kehrt auf die Seite zurück (nur interne Pfade).
 */
export async function GET(request: NextRequest) {
  const l = request.nextUrl.searchParams.get('l')
  const back = request.nextUrl.searchParams.get('zurueck') ?? new URL(request.headers.get('referer') ?? '/', request.url).pathname
  let target = back.startsWith('/') && !back.startsWith('//') && !back.startsWith('/sprache') ? back : '/'
  if (!isLocale(l)) return NextResponse.redirect(new URL(target, env.appUrl))

  if (Object.values(HELP_PAGE).includes(target as never)) target = HELP_PAGE[l]
  ;(await cookies()).set(LOCALE_COOKIE, l, { path: '/', sameSite: 'lax', maxAge: 365 * 24 * 60 * 60, secure: env.isProd })
  const v = await getViewer()
  if (v)
    await db
      .update(profiles)
      .set({ settings: sql`${profiles.settings} || ${JSON.stringify({ locale: l })}::jsonb` })
      .where(eq(profiles.userId, v.userId))
  return NextResponse.redirect(new URL(target, env.appUrl), 303)
}

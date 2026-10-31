import 'server-only'
import { and, eq, gt, ne, sql } from 'drizzle-orm'
import { cookies, headers } from 'next/headers'
import { connection } from 'next/server'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { db } from '@/db'
import { profiles, sessions, users, type Settings } from '@/db/schema'
import { apiContext, bearerToken } from './api-context'
import { sha256, token } from './crypto'
import { env } from './env'
import { isLocale, LOCALE_COOKIE } from '@/messages'

export const SESSION_COOKIE = 'lichtung_session'
const TTL_MS = 30 * 24 * 60 * 60 * 1000
const EXTEND_AFTER_MS = 24 * 60 * 60 * 1000

export type AuthMethod = 'password' | 'passkey' | 'recovery'

export type Viewer = {
  userId: string
  sessionId: string
  authMethod: AuthMethod
  role: 'member' | 'peer_mod' | 'mod' | 'admin'
  status: 'active' | 'muted' | 'banned' | 'deleting'
  mutedUntil: Date | null
  createdAt: Date
  displayName: string
  defaultVisibility: 'anonymous' | 'pseudonym'
  glyphSeed: number
  settings: Settings
}

/** Nur Gerätetyp und Browser – keine IP, kein genauer User-Agent. */
export function deviceLabel(ua: string | null): string {
  const s = ua ?? ''
  // Die iOS-App meldet sich als «Lichtung-iOS/<Version> (iPhone|iPad)».
  if (/Lichtung-iOS\//.test(s)) return `${/iPad/.test(s) ? 'iPad' : 'iPhone'} · App`
  const device = /iPhone/.test(s)
    ? 'iPhone'
    : /iPad/.test(s)
      ? 'iPad'
      : /Android/.test(s)
        ? 'Android'
        : /Macintosh/.test(s)
          ? 'Mac'
          : /Windows/.test(s)
            ? 'Windows'
            : /Linux/.test(s)
              ? 'Linux'
              : 'Gerät'
  const browser = /Edg\//.test(s)
    ? 'Edge'
    : /Firefox\//.test(s)
      ? 'Firefox'
      : /Chrome\//.test(s)
        ? 'Chrome'
        : /Safari\//.test(s)
          ? 'Safari'
          : 'Browser'
  return `${device} · ${browser}`
}

export async function createSession(userId: string, authMethod: AuthMethod) {
  const raw = token()
  const ua = (await headers()).get('user-agent')
  await db.insert(sessions).values({
    userId,
    tokenHash: sha256(raw),
    deviceLabel: deviceLabel(ua),
    authMethod,
    expiresAt: new Date(Date.now() + TTL_MS),
  })
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId))
  // App: Das Token geht in der Antwort zurück (und liegt dort im Schlüsselbund), es gibt kein Cookie.
  const api = apiContext.get()
  if (api) {
    api.token = raw
    return
  }
  ;(await cookies()).set(SESSION_COOKIE, raw, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: TTL_MS / 1000,
  })
  await syncLocale(userId)
}

/**
 * Sprache zwischen Konto und Gerät abgleichen: Hat das Konto eine Sprache, gilt sie auf diesem Gerät;
 * sonst übernimmt das Konto die Sprache, mit der sich die Person gerade angemeldet oder registriert hat.
 */
async function syncLocale(userId: string) {
  const jar = await cookies()
  const [p] = await db.select({ locale: sql<string | null>`${profiles.settings}->>'locale'` }).from(profiles).where(eq(profiles.userId, userId))
  if (!p) return
  if (isLocale(p.locale)) {
    jar.set(LOCALE_COOKIE, p.locale, { path: '/', sameSite: 'lax', maxAge: 365 * 24 * 60 * 60, secure: env.isProd })
    return
  }
  const device = jar.get(LOCALE_COOKIE)?.value
  if (isLocale(device))
    await db
      .update(profiles)
      .set({ settings: sql`${profiles.settings} || ${JSON.stringify({ locale: device })}::jsonb` })
      .where(eq(profiles.userId, userId))
}

/** Liest die Sitzung einmal pro Request. Gleitend 30 Tage gültig. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  // Alles mit Sitzung gehört zum Request – auch die Zeitvergleiche danach.
  await connection()
  const raw = await sessionToken()
  if (!raw) return null
  const rows = await db
    .select({
      sessionId: sessions.id,
      expiresAt: sessions.expiresAt,
      lastSeenAt: sessions.lastSeenAt,
      authMethod: sessions.authMethod,
      userId: users.id,
      role: users.role,
      status: users.status,
      mutedUntil: users.mutedUntil,
      createdAt: users.createdAt,
      displayName: profiles.displayName,
      defaultVisibility: profiles.defaultVisibility,
      glyphSeed: profiles.glyphSeed,
      settings: profiles.settings,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .where(and(eq(sessions.tokenHash, sha256(raw)), gt(sessions.expiresAt, new Date())))
    .limit(1)
  const row = rows[0]
  if (!row || row.status === 'banned' || row.status === 'deleting') return null

  const now = Date.now()
  if (now - row.lastSeenAt.getTime() > EXTEND_AFTER_MS) {
    await db
      .update(sessions)
      .set({ lastSeenAt: new Date(now), expiresAt: new Date(now + TTL_MS) })
      .where(eq(sessions.id, row.sessionId))
  }
  let status = row.status
  if (status === 'muted' && row.mutedUntil && row.mutedUntil.getTime() < now) {
    await db.update(users).set({ status: 'active', mutedUntil: null }).where(eq(users.id, row.userId))
    status = 'active'
  }
  return {
    userId: row.userId,
    sessionId: row.sessionId,
    authMethod: row.authMethod,
    role: row.role,
    status,
    mutedUntil: row.mutedUntil,
    createdAt: row.createdAt,
    displayName: row.displayName,
    defaultVisibility: row.defaultVisibility,
    glyphSeed: row.glyphSeed,
    settings: row.settings,
  }
})

/**
 * Bearer-Token (Apps) oder Cookie (Browser). Innerhalb von /api/v1 zählt nur das Bearer-Token – dort
 * würde ein Cookie sonst Anfragen fremder Webseiten mit der Sitzung der angemeldeten Person ausstatten.
 */
async function sessionToken(): Promise<string | null> {
  const bearer = bearerToken(await headers())
  if (bearer || apiContext.get()) return bearer
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null
}

export async function requireViewer(): Promise<Viewer> {
  const v = await getViewer()
  if (v) return v
  // Abgelaufenes Cookie zuerst entfernen, sonst leitet der Proxy im Kreis.
  if ((await cookies()).has(SESSION_COOKIE)) redirect('/api/session/clear')
  redirect('/anmelden')
}

export async function destroySession() {
  const raw = await sessionToken()
  if (raw) await db.delete(sessions).where(eq(sessions.tokenHash, sha256(raw)))
  if (!apiContext.get()) (await cookies()).delete(SESSION_COOKIE)
}

export async function endOtherSessions(userId: string, keepSessionId?: string) {
  await db
    .delete(sessions)
    .where(keepSessionId ? and(eq(sessions.userId, userId), ne(sessions.id, keepSessionId)) : eq(sessions.userId, userId))
}

export async function cleanupExpiredSessions() {
  await db.execute(sql`DELETE FROM sessions WHERE expires_at < now()`)
}

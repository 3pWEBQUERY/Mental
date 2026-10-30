'use server'

import type { RegistrationResponseJSON } from '@simplewebauthn/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { sessions, users } from '@/db/schema'
import { verifySecret } from '@/lib/server/password'
import { registrationOptions, verifyRegistration } from '@/lib/server/passkey'
import { hit } from '@/lib/server/rate-limit'
import { getViewer } from '@/lib/server/session'

/** Direkt nach dem Login (z. B. bei der Registrierung) genügt die Sitzung. Danach braucht es das Passwort. */
const FRESH_MS = 10 * 60_000

/**
 * Ein neuer Passkey öffnet den Moderationsbereich. Wer nur ein Passwort erbeutet hat, darf sich darum
 * nicht still einen eigenen anlegen: frische Sitzung, bestehender Passkey oder Passwort-Bestätigung.
 */
export async function passkeyRegistrationOptions(password?: string) {
  const viewer = await getViewer()
  if (!viewer) return null
  const [s] = await db.select({ createdAt: sessions.createdAt }).from(sessions).where(eq(sessions.id, viewer.sessionId))
  const fresh = s && Date.now() - s.createdAt.getTime() < FRESH_MS
  if (!fresh && viewer.authMethod !== 'passkey') {
    if (!password) return { reauth: true as const }
    if (!(await hit(`pw-check:${viewer.userId}`, 10, 15 * 60_000)).ok) return { reauth: true as const, failed: true as const }
    const [u] = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, viewer.userId))
    if (!u || !(await verifySecret(u.hash, password))) return { reauth: true as const, failed: true as const }
  }
  return registrationOptions(viewer.userId)
}

export async function finishPasskeyRegistration(response: RegistrationResponseJSON): Promise<boolean> {
  const viewer = await getViewer()
  if (!viewer) return false
  try {
    return await verifyRegistration(viewer.userId, response)
  } catch {
    return false
  }
}

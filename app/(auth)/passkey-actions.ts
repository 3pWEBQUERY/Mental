'use server'

import type { RegistrationResponseJSON } from '@simplewebauthn/server'
import { count, eq } from 'drizzle-orm'
import { db } from '@/db'
import { passkeys, sessions, users } from '@/db/schema'
import { memberRef } from '@/lib/server/crypto'
import { notifyAdmins, notifySystem } from '@/lib/server/notify'
import { verifySecret } from '@/lib/server/password'
import { registrationOptions, verifyRegistration } from '@/lib/server/passkey'
import { hit } from '@/lib/server/rate-limit'
import { getViewer } from '@/lib/server/session'
import { m } from '@/messages'

/** Direkt nach dem Login (z. B. bei der Registrierung) genügt die Sitzung. Danach braucht es das Passwort. */
const FRESH_MS = 10 * 60_000

/**
 * Ein neuer Passkey öffnet den Moderationsbereich. Wer nur ein Passwort erbeutet hat, darf sich darum
 * nicht still einen eigenen anlegen:
 * - Konten mit Moderationsrolle, die schon einen Passkey haben, legen weitere nur aus einer Passkey-Sitzung an –
 *   ein Passwort (oder der Wiederherstellungsschlüssel) genügt dafür nie.
 * - Sonst: frische Sitzung oder Passwort-Bestätigung (schützt gegen ein gestohlenes Sitzungs-Cookie).
 * - Jeder neue Passkey wird gemeldet (Glocke); an Moderationskonten zusätzlich allen Admins.
 */
async function canAddPasskey(password?: string) {
  const viewer = await getViewer()
  if (!viewer) return { ok: false as const }
  const [[s], [u], [{ n } = { n: 0 }]] = await Promise.all([
    db.select({ createdAt: sessions.createdAt }).from(sessions).where(eq(sessions.id, viewer.sessionId)),
    db.select({ role: users.role, hash: users.passwordHash }).from(users).where(eq(users.id, viewer.userId)),
    db.select({ n: count() }).from(passkeys).where(eq(passkeys.userId, viewer.userId)),
  ])
  if (!u) return { ok: false as const }
  const staff = u.role !== 'member'
  if (staff && n > 0 && viewer.authMethod !== 'passkey') return { ok: false as const, needsPasskey: true as const }
  const fresh = s && Date.now() - s.createdAt.getTime() < FRESH_MS
  if (!fresh && viewer.authMethod !== 'passkey') {
    if (!password) return { ok: false as const, reauth: true as const }
    if (!(await hit(`pw-check:${viewer.userId}`, 10, 15 * 60_000)).ok) return { ok: false as const, reauth: true as const, failed: true as const }
    if (!(await verifySecret(u.hash, password))) return { ok: false as const, reauth: true as const, failed: true as const }
  }
  return { ok: true as const, viewer, staff, fresh: Boolean(fresh) }
}

export async function passkeyRegistrationOptions(password?: string) {
  const c = await canAddPasskey(password)
  if (!c.ok) {
    if ('needsPasskey' in c) return { needsPasskey: true as const }
    if ('reauth' in c) return 'failed' in c ? { reauth: true as const, failed: true as const } : { reauth: true as const }
    return null
  }
  return registrationOptions(c.viewer.userId)
}

export async function finishPasskeyRegistration(response: RegistrationResponseJSON): Promise<boolean> {
  // Dieselbe Regel wie beim Anfordern – die Bestätigung darf nicht an ihr vorbei.
  const c = await canAddPasskey()
  if (!c.ok && !('reauth' in c)) return false
  const viewer = await getViewer()
  if (!viewer) return false
  let ok = false
  try {
    ok = await verifyRegistration(viewer.userId, response)
  } catch {
    return false
  }
  if (!ok) return false
  const [u] = await db.select({ role: users.role }).from(users).where(eq(users.id, viewer.userId))
  // Bei der Registrierung (frische Sitzung, normales Konto) keine Meldung – sonst immer.
  const sessionFresh = c.ok && c.fresh
  if (!sessionFresh || u?.role !== 'member') await notifySystem([viewer.userId], m.security.passkeyAdded)
  if (u && u.role !== 'member') await notifyAdmins(m.security.staffPasskeyAdded(memberRef(viewer.userId), u.role), viewer.userId)
  return true
}

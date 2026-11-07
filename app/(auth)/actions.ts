'use server'

import type { AuthenticationResponseJSON } from '@simplewebauthn/server'
import { and, eq, gt, isNotNull, sql } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { db } from '@/db'
import { passkeys, profiles, reservedUsernames, users } from '@/db/schema'
import { LIMITS } from '@/lib/constants'
import { memberRef, randomSeed, seal, unseal } from '@/lib/server/crypto'
import { uuidv7 } from '@/lib/id'
import { burnTime, hashSecret, isPwned, verifySecret } from '@/lib/server/password'
import { authenticationOptions, verifyAuthentication } from '@/lib/server/passkey'
import { clearIp, hit, hitIp, ipHashes, peek, peekIp, type IpHashes } from '@/lib/server/rate-limit'
import { generateRecoveryKey, normalizeRecoveryKey } from '@/lib/server/recovery'
import { createSession, destroySession, endOtherSessions, getViewer } from '@/lib/server/session'
import { verifyPow } from '@/lib/server/altcha'
import { env } from '@/lib/server/env'
import { notifyAdmins, notifySystem } from '@/lib/server/notify'
import { displayNameProblem } from '@/lib/display-name'
import { isValidUsername, looksLikeRealName, normalizeUsername } from '@/lib/username'
import { syncReplyCountsOfAuthor } from '@/lib/reply-count'
import { m } from '@/messages'
import { journalDeletion } from '@/lib/deletion-journal'

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string; field?: string; pow?: true }

const MIN = 60_000
const fail = (error: string, field?: string) => ({ ok: false as const, error, field })

/* ------------------------------------------------------- Registrierung */

export async function checkUsername(raw: string): Promise<Result<{ realName: boolean }>> {
  const limit = await hitIp((ip) => `uname:${ip}`, await ipHashes(), env.usernameChecksPer10Min, 10 * MIN)
  if (!limit.ok) return fail(m.common.rateLimited)
  const username = normalizeUsername(raw)
  if (!isValidUsername(username)) return fail(m.register.usernameInvalid, 'username')
  if (await usernameTaken(username)) return fail(m.register.usernameTaken, 'username')
  return { ok: true, realName: looksLikeRealName(username) }
}

async function usernameTaken(username: string) {
  const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1)
  if (taken) return true
  const [reserved] = await db
    .select({ u: reservedUsernames.username })
    .from(reservedUsernames)
    .where(and(eq(reservedUsernames.username, username), gt(reservedUsernames.until, new Date())))
    .limit(1)
  return Boolean(reserved)
}

export async function checkPassword(password: string): Promise<Result> {
  if (typeof password !== 'string') return fail(m.common.error, 'password')
  // Jede Prüfung fragt Have I Been Pwned – ohne Grenze liesse sich der Server als Abfrage-Proxy missbrauchen.
  if (!(await hitIp((ip) => `pwcheck:${ip}`, await ipHashes(), env.passwordChecksPer10Min, 10 * MIN)).ok) return fail(m.common.rateLimited, 'password')
  if (password.length < 10) return fail(m.register.passwordShort, 'password')
  if (password.length > 256) return fail(m.common.error, 'password')
  if (await isPwned(password)) return fail(m.register.passwordPwned, 'password')
  return { ok: true }
}

/** Der Schlüssel wird hier erzeugt und versiegelt zurückgegeben – so kann niemand einen schwachen eigenen wählen. */
export async function prepareRecoveryKey(): Promise<{ words: string[]; sealed: string }> {
  const words = generateRecoveryKey()
  return { words, sealed: seal(words, 30 * MIN, 'recovery-key') }
}

const registerSchema = z.object({
  username: z.string(),
  password: z.string().min(10).max(256),
  sealedKey: z.string(),
  ageConfirmed: z.literal(true),
  rulesAccepted: z.literal(true),
  pow: z.string().min(10),
})

export async function register(input: z.input<typeof registerSchema>): Promise<Result> {
  const parsed = registerSchema.safeParse(input)
  if (!parsed.success) return fail(m.common.error)
  const { password, sealedKey, pow } = parsed.data
  const username = normalizeUsername(parsed.data.username)

  if (!(await verifyPow(pow))) return fail(m.register.botFailed)
  const ips = await ipHashes()
  // Vorab nur schauen (schnelle Absage); gezählt wird unten atomar, bevor das Konto entsteht.
  if ((await peekIp((ip) => `register:${ip}`, ips, 24 * 60 * MIN)) >= env.registrationsPerIpPerDay) return fail(m.register.tooMany)
  if (!isValidUsername(username)) return fail(m.register.usernameInvalid, 'username')
  if (await usernameTaken(username)) return fail(m.register.usernameTaken, 'username')
  const pw = await checkPassword(password)
  if (!pw.ok) return pw
  const words = unseal<string[]>(sealedKey, 'recovery-key')
  if (!words) return fail(m.common.error)

  // Atomar zählen, bevor das Konto entsteht – parallele Anfragen kommen sonst alle an der Grenze vorbei.
  if (!(await hitIp((ip) => `register:${ip}`, ips, env.registrationsPerIpPerDay, 24 * 60 * MIN)).ok) return fail(m.register.tooMany)

  const now = new Date()
  const [passwordHash, recoveryHash] = await Promise.all([hashSecret(password), hashSecret(words.join(' '))])
  let userId: string
  try {
    userId = await db.transaction(async (tx) => {
      const id = uuidv7()
      const [u] = await tx
        .insert(users)
        .values({ id, username, passwordHash, recoveryHash, ageConfirmedAt: now, rulesAcceptedAt: now, memberRef: memberRef(id) })
        .returning({ id: users.id })
      await tx.insert(profiles).values({ userId: u!.id, displayName: 'Jemand', glyphSeed: randomSeed(), settings: { onboard: true } })
      return u!.id
    })
  } catch {
    return fail(m.register.usernameTaken, 'username')
  }
  await createSession(userId, 'password')
  return { ok: true }
}

export async function setInitialDisplayName(name: string): Promise<Result> {
  const viewer = await getViewer()
  if (!viewer) return fail(m.common.sessionEnded)
  const displayName = name.trim().replace(/\s+/g, ' ').slice(0, LIMITS.displayNameMax)
  if (displayName.length < 2) return fail(m.common.error, 'displayName')
  const problem = displayNameProblem(displayName)
  if (problem) return fail(problem === 'personal' ? m.settings.displayNamePersonal : m.settings.displayNameOfficial, 'displayName')
  await db.update(profiles).set({ displayName }).where(eq(profiles.userId, viewer.userId))
  return { ok: true }
}

/* ------------------------------------------------------------- Anmeldung */

const LOCK_MS = 15 * MIN

async function afterLogin(userId: string, status: string) {
  if (status === 'deleting') {
    // Löschung abgebrochen. Eine laufende Stummschaltung gilt weiter – sonst liesse sie sich mit «Konto löschen»
    // und erneutem Anmelden umgehen.
    await db
      .update(users)
      .set({ status: sql`CASE WHEN ${users.mutedUntil} > now() THEN 'muted'::user_status ELSE 'active'::user_status END`, deleteAfter: null })
      // Nur wenn noch «in Löschung»: Eine Sperre, die während der Anmeldung kam, darf das nicht aufheben.
      .where(and(eq(users.id, userId), isNotNull(users.deleteAfter), eq(users.status, 'deleting')))
    await syncReplyCountsOfAuthor(userId)
    await journalDeletion('account-cancel', userId)
    return m.auth.deletionCancelled
  }
  return null
}

/**
 * Sperre nach Fehlversuchen – pro Benutzername UND Herkunft (IP-Hash). Sonst könnte jede fremde Person ein Konto
 * mit fünf falschen Passwörtern beliebig oft aussperren; auf einer Krisenplattform heisst das: Wer gerade Hilfe
 * sucht, kommt nicht ins eigene Konto. Gegen verteiltes Raten von vielen Adressen gilt zusätzlich eine hohe
 * Schwelle pro Benutzername – sie sperrt aber nie das richtige Passwort, sondern verlangt danach für jeden
 * Versuch eine unsichtbare Rechenaufgabe (ALTCHA): Raten wird teuer, die Person selbst kommt trotzdem herein.
 */
const FAILS_PER_ORIGIN = 5
const FAILS_PER_USERNAME = 50
/** Versuche je Herkunft und Konto, gezählt VOR der Prüfung – gleichzeitig abgeschickte Versuche zählen alle. */
const TRIES_PER_ORIGIN = 10

async function isLocked(username: string, ips: IpHashes) {
  return (await peekIp((ip) => `login-lock:${username}:${ip}`, ips, LOCK_MS)) > 0
}

async function underAttack(username: string) {
  return (await peek(`login-lock:${username}`, LOCK_MS)) > 0
}

/** Zählt einen Fehlversuch; true, wenn damit gesperrt ist. */
async function countFailure(username: string, ips: IpHashes) {
  const [origin, total] = await Promise.all([
    hitIp((ip) => `login-fail:${username}:${ip}`, ips, FAILS_PER_ORIGIN, LOCK_MS),
    hit(`login-fail:${username}`, FAILS_PER_USERNAME, LOCK_MS),
  ])
  if (!total.ok) await hit(`login-lock:${username}`, 1, LOCK_MS)
  if (!origin.ok) {
    await hit(`login-lock:${username}:${ips.today}`, 1, LOCK_MS)
    await clearIp((ip) => `login-fail:${username}:${ip}`, ips)
  }
  return !origin.ok || !total.ok
}

export async function login(input: { username: string; password: string; pow?: string }): Promise<Result<{ notice: string | null }>> {
  const username = normalizeUsername(String(input?.username ?? ''))
  const password = String(input?.password ?? '')
  const ips = await ipHashes()
  if (!(await hitIp((ip) => `login-ip:${ip}`, ips, 30, LOCK_MS)).ok) return fail(m.common.rateLimited)
  // Kein gültiger Benutzername: gleich ablehnen (gleiche Dauer), ohne Zähler mit beliebig langen Schlüsseln.
  if (!isValidUsername(username)) return (await burnTime(password), fail(m.auth.invalid))
  if (await isLocked(username, ips)) return fail(m.auth.locked)
  if (!(await hitIp((ip) => `login-try:${username}:${ip}`, ips, TRIES_PER_ORIGIN, LOCK_MS)).ok) return fail(m.auth.locked)
  if ((await underAttack(username)) && !(await verifyPow(input?.pow))) return { ok: false, error: m.auth.checking, pow: true }

  const [u] = await db
    .select({ id: users.id, hash: users.passwordHash, status: users.status })
    .from(users)
    .where(eq(users.username, username))
    .limit(1)
  const valid = u ? await verifySecret(u.hash, password) : (await burnTime(password), false)

  if (!u || !valid) {
    if (await countFailure(username, ips)) return fail(m.auth.locked)
    return fail(m.auth.invalid)
  }
  if (u.status === 'banned') return fail(m.auth.banned)
  await Promise.all([clearIp((ip) => `login-fail:${username}:${ip}`, ips), clearIp((ip) => `login-try:${username}:${ip}`, ips)])
  const notice = await afterLogin(u.id, u.status)
  await createSession(u.id, 'password')
  return { ok: true, notice }
}

export async function passkeyLoginOptions() {
  if (!(await hitIp((ip) => `pk-ip:${ip}`, await ipHashes(), 30, LOCK_MS)).ok) return null
  return authenticationOptions()
}

export async function passkeyLogin(response: AuthenticationResponseJSON): Promise<Result<{ notice: string | null }>> {
  if (!(await hitIp((ip) => `pk-login-ip:${ip}`, await ipHashes(), 30, LOCK_MS)).ok) return fail(m.common.rateLimited)
  let verified: Awaited<ReturnType<typeof verifyAuthentication>> = null
  try {
    verified = await verifyAuthentication(response)
  } catch {
    verified = null
  }
  if (!verified) return fail(m.auth.passkeyFailed)
  const { userId, legacy, userVerified } = verified
  const [u] = await db.select({ status: users.status, role: users.role }).from(users).where(eq(users.id, userId)).limit(1)
  if (!u || u.status === 'banned') return fail(m.auth.banned)
  const notice = await afterLogin(userId, u.status)
  // Moderationsbereich nur mit bestätigtem Passkey (PIN oder Biometrie) – ein Sicherheitsschlüssel ohne PIN genügt nicht.
  await createSession(userId, u.role !== 'member' && !userVerified ? 'password' : 'passkey')
  // Alter Passkey (frühere Domain): klappt nur über die Brücke – zu einem neuen raten.
  return { ok: true, notice: legacy ? [notice, m.auth.passkeyLegacyNotice].filter(Boolean).join(' ') : notice }
}

export async function logout() {
  await destroySession()
  redirect('/anmelden')
}

/* ------------------------------------------------------ Wiederherstellen */

export async function recover(input: { username: string; key: string; password: string }): Promise<Result<{ words: string[] }>> {
  const username = normalizeUsername(String(input.username ?? ''))
  const key = normalizeRecoveryKey(String(input.key ?? ''))
  const password = String(input.password ?? '')
  const ips = await ipHashes()
  if (!(await hitIp((ip) => `recover-ip:${ip}`, ips, 10, 60 * MIN)).ok) return fail(m.common.rateLimited)
  if (!isValidUsername(username)) return (await burnTime(key), fail(m.auth.recoverInvalid))
  // Nur die Sperre dieser Herkunft: Der Schlüssel (12 Wörter) ist nicht erratbar – die Sperre über alle Herkünfte
  // würde nur Fremden erlauben, die Wiederherstellung zu blockieren.
  if (await isLocked(username, ips)) return fail(m.auth.locked)

  const pw = await checkPassword(password)
  if (!pw.ok) return pw

  const [u] = await db
    .select({ id: users.id, recoveryHash: users.recoveryHash, status: users.status, role: users.role })
    .from(users)
    .where(eq(users.username, username))
    .limit(1)
  const valid = u && key.split(' ').length === 12 ? await verifySecret(u.recoveryHash, key) : (await burnTime(key), false)
  if (!u || !valid) {
    if (await countFailure(username, ips)) return fail(m.auth.locked)
    return fail(m.auth.recoverInvalid)
  }
  if (u.status === 'banned') return fail(m.auth.banned)

  // Neues Passwort, neuer Schlüssel, alle anderen Sitzungen enden.
  const words = generateRecoveryKey()
  const [passwordHash, recoveryHash] = await Promise.all([hashSecret(password), hashSecret(words.join(' '))])
  // Nur wenn der Schlüssel noch derselbe ist: Zwei gleichzeitige Wiederherstellungen dürfen nicht beide gelingen.
  const [changed] = await db
    .update(users)
    .set({ passwordHash, recoveryHash, recoveredAt: new Date() })
    .where(and(eq(users.id, u.id), eq(users.recoveryHash, u.recoveryHash)))
    .returning({ id: users.id })
  if (!changed) return fail(m.auth.recoverInvalid)
  // Passkeys entfernen: Wer sich fremden Zugang über Passwort oder Schlüssel verschafft und einen eigenen Passkey
  // angelegt hat, behält ihn sonst über die Wiederherstellung hinaus.
  await db.delete(passkeys).where(eq(passkeys.userId, u.id))
  await endOtherSessions(u.id)
  await notifySystem([u.id], (t) => t.security.recovered)
  if (u.role !== 'member') await notifyAdmins((t) => t.security.staffRecovered(memberRef(u.id)), u.id)
  await afterLogin(u.id, u.status)
  await createSession(u.id, 'recovery')
  await clearIp((ip) => `login-fail:${username}:${ip}`, ips)
  return { ok: true, words }
}

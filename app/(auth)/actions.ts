'use server'

import type { AuthenticationResponseJSON } from '@simplewebauthn/server'
import { and, eq, gt, isNotNull } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { db } from '@/db'
import { passkeys, profiles, reservedUsernames, users } from '@/db/schema'
import { LIMITS } from '@/lib/constants'
import { memberRef, randomSeed, seal, unseal } from '@/lib/server/crypto'
import { burnTime, hashSecret, isPwned, verifySecret } from '@/lib/server/password'
import { authenticationOptions, verifyAuthentication } from '@/lib/server/passkey'
import { clear, hit, ipHash, peek } from '@/lib/server/rate-limit'
import { generateRecoveryKey, normalizeRecoveryKey } from '@/lib/server/recovery'
import { createSession, destroySession, endOtherSessions, getViewer } from '@/lib/server/session'
import { verifyPow } from '@/lib/server/altcha'
import { env } from '@/lib/server/env'
import { notifyAdmins, notifySystem } from '@/lib/server/notify'
import { displayNameProblem } from '@/lib/display-name'
import { isValidUsername, looksLikeRealName, normalizeUsername } from '@/lib/username'
import { m } from '@/messages'

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string; field?: string }

const MIN = 60_000
const fail = (error: string, field?: string) => ({ ok: false as const, error, field })

/* ------------------------------------------------------- Registrierung */

export async function checkUsername(raw: string): Promise<Result<{ realName: boolean }>> {
  const limit = await hit(`uname:${await ipHash()}`, env.usernameChecksPer10Min, 10 * MIN)
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
  const ip = await ipHash()
  // Vorab nur schauen (schnelle Absage); gezählt wird unten atomar, bevor das Konto entsteht.
  if ((await peek(`register:${ip}`, 24 * 60 * MIN)) >= env.registrationsPerIpPerDay) return fail(m.register.tooMany)
  if (!isValidUsername(username)) return fail(m.register.usernameInvalid, 'username')
  if (await usernameTaken(username)) return fail(m.register.usernameTaken, 'username')
  const pw = await checkPassword(password)
  if (!pw.ok) return pw
  const words = unseal<string[]>(sealedKey, 'recovery-key')
  if (!words) return fail(m.common.error)

  // Atomar zählen, bevor das Konto entsteht – parallele Anfragen kommen sonst alle an der Grenze vorbei.
  if (!(await hit(`register:${ip}`, env.registrationsPerIpPerDay, 24 * 60 * MIN)).ok) return fail(m.register.tooMany)

  const now = new Date()
  const [passwordHash, recoveryHash] = await Promise.all([hashSecret(password), hashSecret(words.join(' '))])
  let userId: string
  try {
    userId = await db.transaction(async (tx) => {
      const [u] = await tx
        .insert(users)
        .values({ username, passwordHash, recoveryHash, ageConfirmedAt: now, rulesAcceptedAt: now })
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
    await db
      .update(users)
      .set({ status: 'active', deleteAfter: null })
      .where(and(eq(users.id, userId), isNotNull(users.deleteAfter)))
    return m.auth.deletionCancelled
  }
  return null
}

/**
 * Sperre nach Fehlversuchen – pro Benutzername UND Herkunft (IP-Hash). Sonst könnte jede fremde Person ein Konto
 * mit fünf falschen Passwörtern beliebig oft aussperren; auf einer Krisenplattform heisst das: Wer gerade Hilfe
 * sucht, kommt nicht ins eigene Konto. Gegen verteiltes Raten von vielen Adressen gilt zusätzlich eine hohe
 * Schwelle pro Benutzername.
 */
const FAILS_PER_ORIGIN = 5
const FAILS_PER_USERNAME = 50

async function isLocked(username: string, ip: string) {
  return (await peek(`login-lock:${username}:${ip}`, LOCK_MS)) > 0 || (await peek(`login-lock:${username}`, LOCK_MS)) > 0
}

/** Zählt einen Fehlversuch; true, wenn damit gesperrt ist. */
async function countFailure(username: string, ip: string) {
  const [origin, total] = await Promise.all([hit(`login-fail:${username}:${ip}`, FAILS_PER_ORIGIN, LOCK_MS), hit(`login-fail:${username}`, FAILS_PER_USERNAME, LOCK_MS)])
  if (!total.ok) await hit(`login-lock:${username}`, 1, LOCK_MS)
  if (!origin.ok) {
    await hit(`login-lock:${username}:${ip}`, 1, LOCK_MS)
    await clear(`login-fail:${username}:${ip}`)
  }
  return !origin.ok || !total.ok
}

export async function login(input: { username: string; password: string }): Promise<Result<{ notice: string | null }>> {
  const username = normalizeUsername(String(input.username ?? ''))
  const password = String(input.password ?? '')
  const ip = await ipHash()
  if (!(await hit(`login-ip:${ip}`, 30, LOCK_MS)).ok) return fail(m.common.rateLimited)
  if (await isLocked(username, ip)) return fail(m.auth.locked)

  const [u] = await db
    .select({ id: users.id, hash: users.passwordHash, status: users.status })
    .from(users)
    .where(eq(users.username, username))
    .limit(1)
  const valid = u ? await verifySecret(u.hash, password) : (await burnTime(password), false)

  if (!u || !valid) {
    if (await countFailure(username, ip)) return fail(m.auth.locked)
    return fail(m.auth.invalid)
  }
  if (u.status === 'banned') return fail(m.auth.banned)
  await clear(`login-fail:${username}:${ip}`)
  const notice = await afterLogin(u.id, u.status)
  await createSession(u.id, 'password')
  return { ok: true, notice }
}

export async function passkeyLoginOptions() {
  if (!(await hit(`pk-ip:${await ipHash()}`, 30, LOCK_MS)).ok) return null
  return authenticationOptions()
}

export async function passkeyLogin(response: AuthenticationResponseJSON): Promise<Result<{ notice: string | null }>> {
  const userId = await verifyAuthentication(response)
  if (!userId) return fail(m.auth.passkeyFailed)
  const [u] = await db.select({ status: users.status }).from(users).where(eq(users.id, userId)).limit(1)
  if (!u || u.status === 'banned') return fail(m.auth.banned)
  const notice = await afterLogin(userId, u.status)
  await createSession(userId, 'passkey')
  return { ok: true, notice }
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
  const ip = await ipHash()
  if (!(await hit(`recover-ip:${ip}`, 10, 60 * MIN)).ok) return fail(m.common.rateLimited)
  if (await isLocked(username, ip)) return fail(m.auth.locked)

  const pw = await checkPassword(password)
  if (!pw.ok) return pw

  const [u] = await db
    .select({ id: users.id, recoveryHash: users.recoveryHash, status: users.status, role: users.role })
    .from(users)
    .where(eq(users.username, username))
    .limit(1)
  const valid = u && key.split(' ').length === 12 ? await verifySecret(u.recoveryHash, key) : (await burnTime(key), false)
  if (!u || !valid) {
    if (await countFailure(username, ip)) return fail(m.auth.locked)
    return fail(m.auth.recoverInvalid)
  }
  if (u.status === 'banned') return fail(m.auth.banned)

  // Neues Passwort, neuer Schlüssel, alle anderen Sitzungen enden.
  const words = generateRecoveryKey()
  const [passwordHash, recoveryHash] = await Promise.all([hashSecret(password), hashSecret(words.join(' '))])
  await db.update(users).set({ passwordHash, recoveryHash }).where(eq(users.id, u.id))
  // Passkeys entfernen: Wer sich fremden Zugang über Passwort oder Schlüssel verschafft und einen eigenen Passkey
  // angelegt hat, behält ihn sonst über die Wiederherstellung hinaus.
  await db.delete(passkeys).where(eq(passkeys.userId, u.id))
  await endOtherSessions(u.id)
  await notifySystem([u.id], (t) => t.security.recovered)
  if (u.role !== 'member') await notifyAdmins((t) => t.security.staffRecovered(memberRef(u.id)), u.id)
  await afterLogin(u.id, u.status)
  await createSession(u.id, 'recovery')
  await clear(`login-fail:${username}:${ip}`)
  return { ok: true, words }
}

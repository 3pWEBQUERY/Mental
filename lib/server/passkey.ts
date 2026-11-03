import 'server-only'
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server'
import { and, eq, isNotNull, ne } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { db } from '@/db'
import { passkeys } from '@/db/schema'
import { seal, unseal } from './crypto'
import { env } from './env'
import { hit } from './rate-limit'

const CHALLENGE_COOKIE = 'lichtung_wa'
const PURPOSE = 'webauthn'

async function storeChallenge(challenge: string, userId?: string) {
  ;(await cookies()).set(CHALLENGE_COOKIE, seal({ challenge, userId }, 5 * 60_000, PURPOSE), {
    httpOnly: true,
    secure: env.isProd,
    sameSite: 'strict',
    path: '/',
    maxAge: 300,
  })
}

async function takeChallenge() {
  const jar = await cookies()
  const value = unseal<{ challenge: string; userId?: string }>(jar.get(CHALLENGE_COOKIE)?.value, PURPOSE)
  jar.delete(CHALLENGE_COOKIE)
  // Jede Aufgabe nur einmal – auch wenn jemand das Cookie aufbewahrt und erneut mitschickt.
  if (value && !(await hit(`wa-used:${value.challenge}`, 1, 5 * 60_000)).ok) return null
  return value
}

/** Der Passkey bekommt nur einen neutralen Namen – kein Benutzername im Gerät sichtbar, ausser man will. */
export async function registrationOptions(userId: string) {
  const existing = await db.select({ id: passkeys.credentialId, transports: passkeys.transports }).from(passkeys).where(eq(passkeys.userId, userId))
  const options = await generateRegistrationOptions({
    rpName: 'Jiaia',
    rpID: env.rpId,
    userName: 'Jiaia',
    userDisplayName: 'Jiaia',
    userID: new TextEncoder().encode(userId),
    attestationType: 'none',
    excludeCredentials: existing.map((c) => ({ id: c.id, transports: (c.transports ?? undefined) as never })),
    authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
  })
  await storeChallenge(options.challenge, userId)
  return options
}

export async function verifyRegistration(userId: string, response: RegistrationResponseJSON) {
  const stored = await takeChallenge()
  if (!stored || stored.userId !== userId) return false
  const result = await verifyRegistrationResponse({
    response,
    expectedChallenge: stored.challenge,
    expectedOrigin: env.appUrl,
    expectedRPID: env.rpId,
    requireUserVerification: false,
  })
  if (!result.verified) return false
  const info = result.registrationInfo
  await db.insert(passkeys).values({
    userId,
    credentialId: info.credential.id,
    publicKey: Buffer.from(info.credential.publicKey).toString('base64url'),
    counter: info.credential.counter,
    deviceType: info.credentialDeviceType,
    backedUp: info.credentialBackedUp,
    transports: info.credential.transports ?? null,
    rpId: env.rpId,
  })
  return true
}

const HOSTNAME = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/

/**
 * Frühere Domains, für die es noch Passkeys gibt (z. B. die Railway-Adresse vor dem Umzug auf jiaia.app).
 * Ein Passkey gehört fest zu der Domain, auf der er angelegt wurde. Über «Related Origin Requests» dürfen
 * Browser ihn trotzdem auf der neuen Domain verwenden. Dafür liefert die alte Domain unter
 * /.well-known/webauthn die neue als erlaubte Adresse (app/.well-known/webauthn/route.ts).
 * Die Werte stammen nur aus env.rpId früherer Deploys, nie aus Eingaben.
 */
export async function relatedRpIds(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ rpId: passkeys.rpId })
    .from(passkeys)
    .where(and(isNotNull(passkeys.rpId), ne(passkeys.rpId, env.rpId)))
    .limit(4)
  return rows.map((r) => r.rpId!).filter((h) => HOSTNAME.test(h))
}

export async function authenticationOptions() {
  const [options, related] = await Promise.all([
    generateAuthenticationOptions({ rpID: env.rpId, userVerification: 'preferred' }),
    relatedRpIds(),
  ])
  await storeChallenge(options.challenge)
  return { options, related }
}

/** Gibt die user_id zurück, wenn der Passkey stimmt – und ob er noch zu einer früheren Domain gehört. */
export async function verifyAuthentication(response: AuthenticationResponseJSON): Promise<{ userId: string; legacy: boolean; userVerified: boolean } | null> {
  const stored = await takeChallenge()
  if (!stored) return null
  const [pk] = await db.select().from(passkeys).where(eq(passkeys.credentialId, response.id)).limit(1)
  if (!pk) return null
  // Jeder Passkey nur für die Domain, auf der er angelegt wurde.
  const rpId = pk.rpId ?? env.rpId
  const result = await verifyAuthenticationResponse({
    response,
    expectedChallenge: stored.challenge,
    expectedOrigin: env.appUrl,
    expectedRPID: rpId,
    requireUserVerification: false,
    credential: {
      id: pk.credentialId,
      publicKey: new Uint8Array(Buffer.from(pk.publicKey, 'base64url')),
      counter: pk.counter,
      transports: (pk.transports ?? undefined) as never,
    },
  })
  if (!result.verified) return null
  await db
    .update(passkeys)
    .set({ counter: result.authenticationInfo.newCounter, lastUsedAt: new Date(), rpId })
    .where(eq(passkeys.id, pk.id))
  return { userId: pk.userId, legacy: rpId !== env.rpId, userVerified: result.authenticationInfo.userVerified }
}

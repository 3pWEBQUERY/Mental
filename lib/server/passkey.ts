import 'server-only'
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server'
import { eq } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { db } from '@/db'
import { passkeys } from '@/db/schema'
import { seal, unseal } from './crypto'
import { env } from './env'

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

export async function authenticationOptions() {
  const options = await generateAuthenticationOptions({ rpID: env.rpId, userVerification: 'preferred' })
  await storeChallenge(options.challenge)
  return options
}

/** Gibt die user_id zurück, wenn der Passkey stimmt. */
export async function verifyAuthentication(response: AuthenticationResponseJSON): Promise<string | null> {
  const stored = await takeChallenge()
  if (!stored) return null
  const [pk] = await db.select().from(passkeys).where(eq(passkeys.credentialId, response.id)).limit(1)
  if (!pk) return null
  const result = await verifyAuthenticationResponse({
    response,
    expectedChallenge: stored.challenge,
    expectedOrigin: env.appUrl,
    expectedRPID: env.rpId,
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
    .set({ counter: result.authenticationInfo.newCounter, lastUsedAt: new Date(), rpId: env.rpId })
    .where(eq(passkeys.id, pk.id))
  return pk.userId
}

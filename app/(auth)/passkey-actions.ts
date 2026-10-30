'use server'

import type { RegistrationResponseJSON } from '@simplewebauthn/server'
import { registrationOptions, verifyRegistration } from '@/lib/server/passkey'
import { getViewer } from '@/lib/server/session'

export async function passkeyRegistrationOptions() {
  const viewer = await getViewer()
  if (!viewer) return null
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

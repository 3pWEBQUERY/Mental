'use client'

import { browserSupportsWebAuthn, startRegistration } from '@simplewebauthn/browser'
import { useEffect, useState } from 'react'
import { finishPasskeyRegistration, passkeyRegistrationOptions } from '@/app/(auth)/passkey-actions'
import { m } from '@/messages'

export function usePasskeySetup() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // Erst nach dem Mount prüfen – sonst unterscheiden sich Server- und Browser-HTML.
  const [supported, setSupported] = useState(false)
  useEffect(() => setSupported(browserSupportsWebAuthn()), [])

  /** 'reauth': Die Sitzung ist nicht mehr frisch – erst das Passwort bestätigen, dann erneut aufrufen. */
  async function setup(password?: string): Promise<boolean | 'reauth'> {
    setBusy(true)
    setError('')
    try {
      const options = await passkeyRegistrationOptions(password)
      if (!options) throw new Error()
      if ('reauth' in options) {
        if ('failed' in options) setError(m.auth.invalid)
        return 'reauth'
      }
      const response = await startRegistration({ optionsJSON: options })
      const ok = await finishPasskeyRegistration(response)
      if (!ok) throw new Error()
      return true
    } catch {
      setError(m.auth.passkeyFailed)
      return false
    } finally {
      setBusy(false)
    }
  }
  return { supported, busy, error, setup }
}

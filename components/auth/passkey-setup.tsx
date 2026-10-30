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

  async function setup(): Promise<boolean> {
    setBusy(true)
    setError('')
    try {
      const options = await passkeyRegistrationOptions()
      if (!options) throw new Error()
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

import type { Metadata } from 'next'
import { Suspense } from 'react'
import { LoginForm } from '@/components/auth/login-form'
import { PublicShell } from '@/components/ui'
import { m } from '@/messages'

export const metadata: Metadata = { title: m.auth.login }

export default function Page() {
  return (
    <PublicShell active="login">
      <Suspense>
        <LoginForm />
      </Suspense>
    </PublicShell>
  )
}

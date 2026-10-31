import type { Metadata } from 'next'
import { Suspense } from 'react'
import { LoginForm } from '@/components/auth/login-form'
import { PublicShell } from '@/components/ui'
import { m } from '@/messages'

// Pro Anfrage, damit der Titel in der gewählten Sprache erscheint.
export async function generateMetadata(): Promise<Metadata> {
  return { title: m.auth.login }
}

export default function Page() {
  return (
    <PublicShell active="login">
      <Suspense>
        <LoginForm />
      </Suspense>
    </PublicShell>
  )
}

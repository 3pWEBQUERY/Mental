import type { Metadata } from 'next'
import { Suspense } from 'react'
import { RegisterFlow } from '@/components/auth/register-flow'
import { PublicShell } from '@/components/ui'
import { m } from '@/messages'

// Pro Anfrage, damit der Titel in der gewählten Sprache erscheint.
export async function generateMetadata(): Promise<Metadata> {
  return { title: m.auth.register }
}

export default function Page() {
  return (
    <PublicShell active="register">
      <Suspense>
        <RegisterFlow />
      </Suspense>
    </PublicShell>
  )
}

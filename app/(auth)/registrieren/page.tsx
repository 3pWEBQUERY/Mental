import type { Metadata } from 'next'
import { Suspense } from 'react'
import { RegisterFlow } from '@/components/auth/register-flow'
import { PublicShell } from '@/components/ui'
import { m } from '@/messages'
import { pageMeta } from '@/lib/seo'

// Pro Anfrage, damit der Titel in der gewählten Sprache erscheint.
export async function generateMetadata(): Promise<Metadata> {
  return pageMeta({ title: m.auth.register, description: m.seo.register, path: '/registrieren' })
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

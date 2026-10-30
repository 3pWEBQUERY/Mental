import type { Metadata } from 'next'
import { Suspense } from 'react'
import { RegisterFlow } from '@/components/auth/register-flow'
import { PublicShell } from '@/components/ui'
import { m } from '@/messages'

export const metadata: Metadata = { title: m.auth.register }

export default function Page() {
  return (
    <PublicShell active="register">
      <Suspense>
        <RegisterFlow />
      </Suspense>
    </PublicShell>
  )
}

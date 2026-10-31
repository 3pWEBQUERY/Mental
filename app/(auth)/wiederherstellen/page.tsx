import type { Metadata } from 'next'
import { Suspense } from 'react'
import { RecoverForm } from '@/components/auth/recover-form'
import { PublicShell } from '@/components/ui'
import { m } from '@/messages'

// Pro Anfrage, damit der Titel in der gewählten Sprache erscheint.
export async function generateMetadata(): Promise<Metadata> {
  return { title: m.auth.recoverTitle }
}

export default function Page() {
  return (
    <PublicShell>
      <Suspense>
        <RecoverForm />
      </Suspense>
    </PublicShell>
  )
}

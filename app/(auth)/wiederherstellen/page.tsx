import type { Metadata } from 'next'
import { Suspense } from 'react'
import { RecoverForm } from '@/components/auth/recover-form'
import { PublicShell } from '@/components/ui'
import { m } from '@/messages'
import { NO_INDEX } from '@/lib/seo'

// Pro Anfrage, damit der Titel in der gewählten Sprache erscheint.
export async function generateMetadata(): Promise<Metadata> {
  return { title: m.auth.recoverTitle, robots: NO_INDEX }
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

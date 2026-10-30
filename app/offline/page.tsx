import type { Metadata } from 'next'
import { HelpList, PublicShell } from '@/components/ui'
import { DEFAULT_HELP } from '@/lib/help'
import { m } from '@/messages'

export const metadata: Metadata = { title: 'Offline' }

/** Wird vom Service Worker gezeigt, wenn keine Verbindung besteht. Die Nummern funktionieren immer. */
export default function Offline() {
  return (
    <PublicShell active="help">
      <div className="help-page">
        <h1 className="display">
          {m.offline.titleLead} <em>{m.offline.titleEm}</em>
        </h1>
        <p className="lead" style={{ color: 'var(--ink-2)', marginTop: 14 }}>
          {m.offline.body}
        </p>
        <section className="help">
          <HelpList resources={DEFAULT_HELP} />
        </section>
      </div>
    </PublicShell>
  )
}

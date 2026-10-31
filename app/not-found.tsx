import type { Metadata } from 'next'
import Link from 'next/link'
import { HelpList, PublicShell } from '@/components/ui'
import { DEFAULT_HELP } from '@/lib/help'
import { m } from '@/messages'

export const metadata: Metadata = { title: '404' }

/** Auch auf einer Fehlerseite sind die Hilfe-Nummern nur einen Blick entfernt. */
export default function NotFound() {
  const e = m.errors
  return (
    <PublicShell>
      <div className="help-page">
        <h1 className="display">
          {e.notFoundLead} <em>{e.notFoundEm}</em>
        </h1>
        <p className="lead" style={{ color: 'var(--ink-2)', marginTop: 14 }}>
          {e.notFoundBody}
        </p>
        <p style={{ marginTop: 22 }}>
          <Link className="btn" href="/start">
            {e.back}
          </Link>
        </p>
        <section className="help">
          <HelpList resources={DEFAULT_HELP} />
        </section>
      </div>
    </PublicShell>
  )
}

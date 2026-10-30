'use client'

import { HelpList, PublicShell } from '@/components/ui'
import { DEFAULT_HELP } from '@/lib/help'
import { m } from '@/messages'

/** Fehler unterhalb des Root-Layouts: ruhig erklären, neu versuchen lassen, Hilfe immer sichtbar. */
export default function ErrorPage({ retry }: { error: unknown; retry: () => void }) {
  const e = m.errors
  return (
    <PublicShell>
      <div className="help-page">
        <h1 className="display">
          {e.errorLead} <em>{e.errorEm}</em>
        </h1>
        <p className="lead" style={{ color: 'var(--ink-2)', marginTop: 14 }}>
          {e.errorBody}
        </p>
        <p style={{ marginTop: 22 }}>
          <button type="button" className="btn" onClick={() => retry()}>
            {e.retry}
          </button>
        </p>
        <section className="help">
          <HelpList resources={DEFAULT_HELP} />
        </section>
      </div>
    </PublicShell>
  )
}

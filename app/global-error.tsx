'use client'

import { HelpList } from '@/components/ui'
import { DEFAULT_HELP } from '@/lib/help'
import { m } from '@/messages'
import './globals.css'

/** Fällt sogar das Root-Layout aus, ersetzt diese Seite das ganze Dokument – mit den Nummern. */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  const e = m.errors
  return (
    <html lang="de-CH">
      <body>
        <title>{`${m.brand} · Fehler`}</title>
        <main className="public-main" style={{ maxWidth: 760, margin: '0 auto', padding: '48px 20px' }}>
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
        </main>
      </body>
    </html>
  )
}

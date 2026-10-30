import type { Metadata } from 'next'
import { HelpList, PhoneScript, PublicShell } from '@/components/ui'
import { getHelpResources } from '@/lib/server/terms'
import { m } from '@/messages'

// Vollständig vorgerendert: Die Hilfe funktioniert auch, wenn Datenbank oder Login ausfallen.
export const ensureStatic = 'navigation'

export const metadata: Metadata = { title: m.help.pageTitle }

export default async function HelpPage() {
  const resources = await getHelpResources()
  return (
    <PublicShell active="help">
      <div className="help-page">
        <h1 className="display">
          {m.help.pageTitleLead} <em>{m.help.pageTitleEm}</em>
        </h1>
        <p className="lead" style={{ color: 'var(--ink-2)', margin: '14px 0 0', maxWidth: '52ch' }}>
          {m.help.pageIntro}
        </p>
        <section className="help">
          <HelpList resources={resources} />
        </section>
        <PhoneScript />
        <div className="prose">
          <p className="notice" style={{ marginTop: 22 }}>
            {m.help.honest}
          </p>
          <h2>{m.help.alsoTitle}</h2>
          <ul className="dash">
            {m.help.also.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      </div>
    </PublicShell>
  )
}

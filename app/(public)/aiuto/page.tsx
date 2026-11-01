import type { Metadata } from 'next'
import { HelpList, PhoneScript, PublicShell } from '@/components/ui'
import { getHelpResources } from '@/lib/server/terms'
import { getMessages } from '@/messages'

// Wie /hilfe vollständig vorgerendert: funktioniert ohne Anmeldung, ohne Datenbank und offline (Service Worker).
export const ensureStatic = 'navigation'

const it = getMessages('it')

export const metadata: Metadata = { title: it.help.pageTitle, alternates: { languages: { 'de-CH': '/hilfe', 'fr-CH': '/aide', 'it-CH': '/aiuto' } } }

/** Aiuto immediato – die italienische Hilfeseite für das Tessin und die italienischsprachigen Täler. */
export default async function AiutoPage() {
  const resources = await getHelpResources('it')
  return (
    <PublicShell active="help" t={it} lang="it-CH">
      <div className="help-page">
        <h1 className="display">
          {it.help.pageTitleLead} <em>{it.help.pageTitleEm}</em>
        </h1>
        <p className="lead" style={{ color: 'var(--ink-2)', margin: '14px 0 0', maxWidth: '52ch' }}>
          {it.help.pageIntro}
        </p>
        <section className="help">
          <HelpList resources={resources} t={it} />
        </section>
        <PhoneScript t={it} />
        <div className="prose">
          <p className="notice" style={{ marginTop: 22 }}>
            {it.help.honest}
          </p>
          <h2>{it.help.alsoTitle}</h2>
          <ul className="dash">
            {it.help.also.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      </div>
    </PublicShell>
  )
}

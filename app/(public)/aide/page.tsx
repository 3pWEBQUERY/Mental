import type { Metadata } from 'next'
import { HelpList, PhoneScript, PublicShell } from '@/components/ui'
import { getHelpResources } from '@/lib/server/terms'
import { getMessages } from '@/messages'

// Wie /hilfe vollständig vorgerendert: funktioniert ohne Anmeldung, ohne Datenbank und offline (Service Worker).
export const ensureStatic = 'navigation'

const fr = getMessages('fr')

export const metadata: Metadata = { title: fr.help.pageTitle, alternates: { languages: { 'de-CH': '/hilfe', 'fr-CH': '/aide', 'it-CH': '/aiuto' } } }

/** Aide immédiate – die französische Hilfeseite für die Romandie. */
export default async function AidePage() {
  const resources = await getHelpResources('fr')
  return (
    <PublicShell active="help" t={fr} lang="fr-CH">
      <div className="help-page">
        <h1 className="display">
          {fr.help.pageTitleLead} <em>{fr.help.pageTitleEm}</em>
        </h1>
        <p className="lead" style={{ color: 'var(--ink-2)', margin: '14px 0 0', maxWidth: '52ch' }}>
          {fr.help.pageIntro}
        </p>
        <section className="help">
          <HelpList resources={resources} t={fr} />
        </section>
        <PhoneScript t={fr} />
        <div className="prose">
          <p className="notice" style={{ marginTop: 22 }}>
            {fr.help.honest}
          </p>
          <h2>{fr.help.alsoTitle}</h2>
          <ul className="dash">
            {fr.help.also.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      </div>
    </PublicShell>
  )
}

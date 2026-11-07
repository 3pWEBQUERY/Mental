import type { Metadata } from 'next'
import { HelpList, PhoneScript, PublicShell } from '@/components/ui'
import { TopicHelp } from '@/components/topic-help'
import { getHelpResources } from '@/lib/server/terms'
import { getMessages } from '@/messages'

// Wie /hilfe vollständig vorgerendert: funktioniert ohne Anmeldung, ohne Datenbank und offline (Service Worker).
export const ensureStatic = 'navigation'

const en = getMessages('en')

export const metadata: Metadata = { title: en.help.pageTitle, alternates: { languages: { 'de-CH': '/hilfe', 'fr-CH': '/aide', 'it-CH': '/aiuto', 'en-CH': '/help' } } }

/** Immediate help – die englische Hilfeseite (für alle, die in der Schweiz lieber Englisch lesen). */
export default async function HelpPage() {
  const resources = await getHelpResources('en')
  return (
    <PublicShell active="help" t={en} lang="en-CH">
      <div className="help-page">
        <h1 className="display">
          {en.help.pageTitleLead} <em>{en.help.pageTitleEm}</em>
        </h1>
        <p className="lead" style={{ color: 'var(--ink-2)', margin: '14px 0 0', maxWidth: '52ch' }}>
          {en.help.pageIntro}
        </p>
        <section className="help">
          <HelpList resources={resources} t={en} />
        </section>
        <PhoneScript t={en} />
        <TopicHelp locale="en" t={en} />
        <div className="prose">
          <p className="notice" style={{ marginTop: 22 }}>
            {en.help.honest}
          </p>
          <h2>{en.help.alsoTitle}</h2>
          <ul className="dash">
            {en.help.also.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      </div>
    </PublicShell>
  )
}

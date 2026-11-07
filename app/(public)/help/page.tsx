import type { Metadata } from 'next'
import { connection } from 'next/server'
import { HelpList, PhoneScript, PublicShell } from '@/components/ui'
import { TopicHelp } from '@/components/topic-help'
import { getHelpResources } from '@/lib/server/terms'
import { getMessages } from '@/messages'

// Bei jeder Anfrage gerendert (Daten aus dem Zwischenspeicher, höchstens 2 s Datenbank, sonst die Notfall-Liste).
// Vorgerendert hätte der erste Besuch nach einem Deploy die Fassung vom Build gezeigt – ohne Datenbank gebaut, also
// ohne Chats und ohne «Nach Thema» – und erst beim Neuladen die richtige. Offline speichert der Service Worker die Seite.
export const instant = false

const en = getMessages('en')

export const metadata: Metadata = { title: en.help.pageTitle, alternates: { languages: { 'de-CH': '/hilfe', 'fr-CH': '/aide', 'it-CH': '/aiuto', 'en-CH': '/help' } } }

/** Immediate help – die englische Hilfeseite (für alle, die in der Schweiz lieber Englisch lesen). */
export default async function HelpPage() {
  await connection()
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

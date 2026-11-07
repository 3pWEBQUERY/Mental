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

/** /hilfe ist immer Deutsch – Französisch, Italienisch und Englisch haben eigene Seiten. */
const de = getMessages('de')

export const metadata: Metadata = { title: de.help.pageTitle, alternates: { languages: { 'de-CH': '/hilfe', 'fr-CH': '/aide', 'it-CH': '/aiuto', 'en-CH': '/help' } } }

export default async function HelpPage() {
  await connection()
  const resources = await getHelpResources()
  return (
    <PublicShell active="help" t={de} lang="de-CH">
      <div className="help-page">
        <h1 className="display">
          {de.help.pageTitleLead} <em>{de.help.pageTitleEm}</em>
        </h1>
        <p className="lead" style={{ color: 'var(--ink-2)', margin: '14px 0 0', maxWidth: '52ch' }}>
          {de.help.pageIntro}
        </p>
        <section className="help">
          <HelpList resources={resources} t={de} />
        </section>
        <PhoneScript t={de} />
        <TopicHelp locale="de" t={de} />
        <div className="prose">
          <p className="notice" style={{ marginTop: 22 }}>
            {de.help.honest}
          </p>
          <h2>{de.help.alsoTitle}</h2>
          <ul className="dash">
            {de.help.also.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      </div>
    </PublicShell>
  )
}

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

const it = getMessages('it')

export const metadata: Metadata = { title: it.help.pageTitle, alternates: { languages: { 'de-CH': '/hilfe', 'fr-CH': '/aide', 'it-CH': '/aiuto', 'en-CH': '/help' } } }

/** Aiuto immediato – die italienische Hilfeseite für das Tessin und die italienischsprachigen Täler. */
export default async function AiutoPage() {
  await connection()
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
        <TopicHelp locale="it" t={it} />
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

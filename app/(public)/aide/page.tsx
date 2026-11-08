import type { Metadata } from 'next'
import { connection } from 'next/server'
import { HelpList, PhoneScript, PublicShell } from '@/components/ui'
import { TopicHelp } from '@/components/topic-help'
import { getHelpResources } from '@/lib/server/terms'
import { getMessages } from '@/messages'
import { pageMeta } from '@/lib/seo'

// Bei jeder Anfrage gerendert (Daten aus dem Zwischenspeicher, höchstens 2 s Datenbank, sonst die Notfall-Liste).
// Vorgerendert hätte der erste Besuch nach einem Deploy die Fassung vom Build gezeigt – ohne Datenbank gebaut, also
// ohne Chats und ohne «Nach Thema» – und erst beim Neuladen die richtige. Offline speichert der Service Worker die Seite.
export const instant = false

const fr = getMessages('fr')

const seo = pageMeta({ title: fr.help.pageTitle, description: fr.help.metaDescription, path: '/aide', locale: 'fr' })
export const metadata: Metadata = {
  ...seo,
  alternates: { canonical: '/aide', languages: { 'de-CH': '/hilfe', 'fr-CH': '/aide', 'it-CH': '/aiuto', 'en-CH': '/help', 'x-default': '/hilfe' } },
}

/** Aide immédiate – die französische Hilfeseite für die Romandie. */
export default async function AidePage() {
  await connection()
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
        <TopicHelp locale="fr" t={fr} />
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

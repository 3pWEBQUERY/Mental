import { HelpList } from '@/components/ui'
import { localizeCircle } from '@/lib/localize'
import { getCircleHelp, getCirclesForStaticPage } from '@/lib/server/terms'
import type { Locale, Messages } from '@/messages'

/**
 * Hilfeseiten: Stellen zu einzelnen Themen, gruppiert nach Kreis (Admin → Hilfe, Feld «Kreis»).
 * Beim Build ohne Datenbank leer – die Seite erscheint dann mit der nächsten Revalidierung samt Themen.
 */
export async function TopicHelp({ locale, t }: { locale: Locale; t: Messages }) {
  const [help, circles] = await Promise.all([getCircleHelp(locale), getCirclesForStaticPage()])
  const groups = circles
    .filter((c) => help[c.slug]?.length)
    .map((c) => ({ slug: c.slug, name: localizeCircle(c, locale).name, list: help[c.slug]! }))
  if (!groups.length) return null
  return (
    <section className="topic-help" aria-labelledby="nach-thema">
      <h2 id="nach-thema">{t.help.byTopicTitle}</h2>
      <p className="fine">{t.help.byTopicIntro}</p>
      {groups.map((g) => (
        <section key={g.slug} className="help" aria-label={g.name}>
          <h3>{g.name}</h3>
          <HelpList resources={g.list} eyebrow={false} intro={false} t={t} />
        </section>
      ))}
    </section>
  )
}

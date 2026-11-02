import { HelpList } from '@/components/ui'
import { localizeCircle } from '@/lib/localize'
import { getCircleHelp, getCirclesForStaticPage, getHelpResources } from '@/lib/server/terms'
import type { Locale, Messages } from '@/messages'

/**
 * Hilfeseiten: Stellen zu einzelnen Themen, gruppiert nach Kreis (Admin → Hilfe, Feld «Kreis»). Nur, was nicht
 * schon in der allgemeinen Liste darüber steht.
 * Beim Build ohne Datenbank leer – die Seite erscheint dann mit der nächsten Revalidierung samt Themen.
 */
export async function TopicHelp({ locale, t }: { locale: Locale; t: Messages }) {
  const [help, circles, general] = await Promise.all([getCircleHelp(locale), getCirclesForStaticPage(), getHelpResources(locale)])
  // Was oben schon in der allgemeinen Liste steht (z. B. 143, 147), nicht bei jedem Thema wiederholen.
  const key = (h: { phone: string | null; url: string | null }) => (h.phone ? `tel:${h.phone.replace(/\s/g, '')}` : (h.url ?? ''))
  const shown = new Set(general.map(key))
  const groups = circles
    .map((c) => ({ slug: c.slug, name: localizeCircle(c, locale).name, list: (help[c.slug] ?? []).filter((h) => !shown.has(key(h))) }))
    .filter((g) => g.list.length)
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

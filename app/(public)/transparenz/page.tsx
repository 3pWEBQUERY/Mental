import type { Metadata } from 'next'
import Link from 'next/link'
import { connection } from 'next/server'
import { PublicShell } from '@/components/ui'
import { getTransparency, type Figure } from '@/lib/server/transparency'
import { lazy, localeTag, m } from '@/messages'
import { pageMeta } from '@/lib/seo'

// Pro Anfrage in der gewählten Sprache (Cookie) – bewusst kein vorgerenderter Shell.
export const instant = false

// Pro Anfrage, damit der Titel in der gewählten Sprache erscheint.
export async function generateMetadata(): Promise<Metadata> {
  return pageMeta({ title: m.transparency.title, description: m.seo.transparency, path: '/transparenz' })
}

const t = lazy('transparency')
const fmt = (f: Figure) => ('below' in f ? t.below(f.below) : f.n.toLocaleString(localeTag()))

/**
 * Transparenz: zuerst, wie Jiaia arbeitet und was wir versprechen – das gilt vom ersten Tag an. Zahlen pro Quartal
 * erst, wenn ein abgeschlossenes Quartal genug Austausch hatte (PUBLISH_MIN_POSTS); vorher wären es fast nur
 * «weniger als 10» und einzelne Fälle zu leicht herauszulesen.
 */
export default async function TransparencyPage() {
  await connection()
  const quarters = await getTransparency()
  const published = (quarters ?? []).filter((q) => q.publishable)
  return (
    <PublicShell>
      <div className="prose" style={{ margin: '0 auto' }}>
        <h1 className="display">{t.title}</h1>
        <p>{t.intro}</p>

        {published.length === 0 && (
          <section className="card transparency-early" aria-labelledby="t-early">
            <h2 id="t-early">{t.earlyTitle}</h2>
            <p>{t.early}</p>
          </section>
        )}

        <section aria-labelledby="t-promises">
          <h2 id="t-promises">{t.promisesTitle}</h2>
          <ul className="dash">
            {t.promises.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="t-how">
          <h2 id="t-how">{t.howTitle}</h2>
          <ul className="dash">
            {t.how.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </section>

        {published.length === 0 ? (
          <section aria-labelledby="t-planned">
            <h2 id="t-planned">{t.plannedTitle}</h2>
            <p>{t.plannedIntro}</p>
            <ul className="dash">
              {t.planned.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </section>
        ) : (
          published.map((q) => {
            const id = `q-${q.year}-${q.q}`
            return (
              <section key={id} aria-labelledby={id} className="transparency-quarter">
                <h2 id={id}>{t.quarter(q.q, q.year)}</h2>
                <h3>{t.activity}</h3>
                <dl className="facts">
                  <Fact label={t.posts} value={fmt(q.posts)} />
                  <Fact label={t.replies} value={fmt(q.replies)} />
                  <Fact label={t.answered} value={q.answeredShare === null ? t.tooFew : `${q.answeredShare} %`} />
                </dl>
                <h3>{t.moderation}</h3>
                <dl className="facts">
                  <Fact label={t.reports} value={fmt(q.reports)} />
                  <Fact label={t.crisisMedian} value={q.crisisMedian === null ? t.tooFew : t.minutes(q.crisisMedian)} />
                  <Fact label={t.hidden} value={fmt(q.hidden)} />
                  <Fact label={t.warnings} value={fmt(q.warnings)} />
                  <Fact label={t.mutes} value={fmt(q.mutes)} />
                  <Fact label={t.bans} value={fmt(q.bans)} />
                  <Fact label={t.appeals} value={`${fmt(q.appeals)} · ${t.appealsAccepted} ${fmt(q.appealsAccepted)}`} />
                </dl>
                {q.byReason.length > 0 && (
                  <>
                    <h3>{t.byReason}</h3>
                    <table className="table">
                      <tbody>
                        {q.byReason.map((r) => (
                          <tr key={r.reason}>
                            <td>{t.reasons[r.reason] ?? t.reasons.other}</td>
                            <td>{fmt(r.n)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </section>
            )
          })
        )}
        {published.length > 0 && <p className="fine">{t.method}</p>}
        <p className="fine">
          {t.questions} <Link href="/impressum">{t.imprint}</Link>
        </p>
      </div>
    </PublicShell>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

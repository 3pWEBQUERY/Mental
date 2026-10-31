import type { Metadata } from 'next'
import { connection } from 'next/server'
import { PublicShell } from '@/components/ui'
import { getTransparency, type Figure } from '@/lib/server/transparency'
import { lazy, localeTag, m } from '@/messages'

// Pro Anfrage in der gewählten Sprache (Cookie) – bewusst kein vorgerenderter Shell.
export const instant = false

// Pro Anfrage, damit der Titel in der gewählten Sprache erscheint.
export async function generateMetadata(): Promise<Metadata> {
  return { title: m.transparency.title }
}

const t = lazy('transparency')
const fmt = (f: Figure) => ('below' in f ? t.below(f.below) : f.n.toLocaleString(localeTag()))

/** Öffentlicher Transparenzbericht: Zahlen pro Quartal, kleine Werte unterdrückt. Vorgerendert, stündlich neu. */
export default async function TransparencyPage() {
  await connection()
  const quarters = await getTransparency()
  return (
    <PublicShell>
      <div className="prose" style={{ margin: '0 auto' }}>
        <h1 className="display">{t.title}</h1>
        <p>{t.intro}</p>
        {!quarters ? (
          <p className="notice">{t.unavailable}</p>
        ) : (
          quarters.map((q) => (
            <section key={q.label} aria-labelledby={`q-${q.label}`} className="transparency-quarter">
              <h2 id={`q-${q.label}`}>{q.label}</h2>
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
          ))
        )}
        <p className="fine">{t.method}</p>
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

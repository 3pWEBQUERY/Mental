import type { Metadata } from 'next'
import { PublicShell } from '@/components/ui'
import { getCirclesForStaticPage } from '@/lib/server/terms'
import { m } from '@/messages'

export const metadata: Metadata = { title: m.rules.title }

export default async function RulesPage() {
  const circles = await getCirclesForStaticPage()
  return (
    <PublicShell>
      <div className="prose" style={{ margin: '0 auto' }}>
        <h1 className="display">{m.rules.title}</h1>
        <p>{m.rules.intro}</p>
        <ol>
          {m.rules.items.map(([title, body]) => (
            <li key={title}>
              <b>{title}</b>
              {body}
            </li>
          ))}
        </ol>
        <p className="notice">{m.rules.moderation}</p>
        {circles.length > 0 && (
          <>
            <h2>{m.circles.title}</h2>
            <ul className="stack" style={{ marginTop: 14 }}>
              {circles.map((c) => (
                <li key={c.slug} className="card">
                  <div className="post-meta" style={{ marginBottom: 6 }}>
                    <i className="dot" style={{ background: c.color }} />
                    <span className="who">{c.name}</span>
                  </div>
                  <p style={{ margin: '4px 0' }}>{c.description}</p>
                  <p className="fine">
                    {m.circles.rules}: {c.rules}
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </PublicShell>
  )
}

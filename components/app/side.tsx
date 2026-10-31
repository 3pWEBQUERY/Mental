'use client'

import Link from 'next/link'
import { m } from '@/messages'
import type { ReactNode } from 'react'
import { HelpList } from '../ui'
import { useViewer } from '../viewer'

/**
 * Seitenleiste. Kreise, Hilfe-Nummern und Fusszeile kommen aus dem Layout und stehen sofort da;
 * nur Anwesenheit und der kleine Schritt werden nachgereicht (`circles`/`step` als gestreamte Slots).
 */
export function Side({ circles, step }: { circles: ReactNode; step: ReactNode }) {
  const viewer = useViewer()
  return (
    <aside className="side" aria-label={m.nav.side}>
      <section>
        <h2 className="section-label">{m.circles.title}</h2>
        {circles}
      </section>
      {step}
      <section className="help">
        <HelpList resources={viewer.help.filter((h) => h.phone)} />
      </section>
      <p className="fine">
        {m.common.fine}
        <br />
        <Link href="/regeln">{m.landing.rules}</Link> · <Link href="/datenschutz">{m.landing.privacy}</Link> ·{' '}
        <Link href="/impressum">{m.landing.imprint}</Link>
      </p>
    </aside>
  )
}

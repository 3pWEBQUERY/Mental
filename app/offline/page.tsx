import type { Metadata } from 'next'
import { HelpList, PublicShell } from '@/components/ui'
import { DEFAULT_HELP } from '@/lib/help'
import { PLAN_KEY } from '@/lib/client/private-storage'
import { PLAN_FIELDS } from '@/components/me/plan-fields'
import { m } from '@/messages'

export const metadata: Metadata = { title: 'Offline' }

/**
 * Füllt den Notfallplan aus der freiwilligen Offline-Kopie ein. Ein Inline-Skript statt einer Client-Komponente:
 * Offline sind die JavaScript-Dateien von Next.js nicht im Cache, nur diese Seite selbst. Nur textContent – nie HTML.
 */
const PLAN_SCRIPT = `(function(){try{var d=JSON.parse(localStorage.getItem(${JSON.stringify(PLAN_KEY)})||'null');if(!d||!d.plan)return;var f=${JSON.stringify(
  PLAN_FIELDS.map((k) => [k, m.plan.fields[k].label]),
)};var r=document.getElementById('offline-plan');var ol=r.querySelector('ol');var n=0;f.forEach(function(x){var v=d.plan[x[0]];if(typeof v!=='string'||!v)return;var li=document.createElement('li');var h=document.createElement('h3');h.textContent=x[1];var p=document.createElement('p');p.textContent=v;li.appendChild(h);li.appendChild(p);ol.appendChild(li);n++});if(n)r.hidden=false}catch(e){}})()`

/** Wird vom Service Worker gezeigt, wenn keine Verbindung besteht. Die Nummern funktionieren immer. */
export default function Offline() {
  return (
    <PublicShell active="help">
      <div className="help-page">
        <h1 className="display">
          {m.offline.titleLead} <em>{m.offline.titleEm}</em>
        </h1>
        <p className="lead" style={{ color: 'var(--ink-2)', marginTop: 14 }}>
          {m.offline.body}
        </p>
        <section className="help">
          <HelpList resources={DEFAULT_HELP} />
        </section>
        <section id="offline-plan" className="for-me-block" aria-labelledby="offline-plan-title" hidden>
          <h2 id="offline-plan-title" className="section-label">
            {m.offline.plan}
          </h2>
          <ol className="plan-view" />
        </section>
        <script dangerouslySetInnerHTML={{ __html: PLAN_SCRIPT }} />
      </div>
    </PublicShell>
  )
}

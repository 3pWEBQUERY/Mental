import { asc } from 'drizzle-orm'
import { db } from '@/db'
import { circles, helpResources } from '@/db/schema'
import { AdminForm, DeleteButton } from '@/components/admin/admin-form'
import { requireModerator } from '@/lib/server/admin'
import { m } from '@/messages'
import { deleteHelp, saveHelp } from '../actions'

type Help = typeof helpResources.$inferSelect
type Circle = typeof circles.$inferSelect

const LANGS = [
  { code: 'de', name: 'Deutsch', page: '/hilfe' },
  { code: 'fr', name: 'Französisch', page: '/aide' },
  { code: 'it', name: 'Italienisch', page: '/aiuto' },
] as const

/**
 * Hilfe-Nummern je Sprache: anlegen, bearbeiten, löschen. Sie erscheinen sofort unter «Sofort Hilfe» in der App,
 * auf /hilfe, /aide und /aiuto und in der iOS-App (cacheTag «help»). Ist eine Sprache leer, gelten dort die
 * eingebauten Standardnummern (lib/help.ts).
 */
export default async function HelpAdmin() {
  await requireModerator('admin')
  const [rows, circleRows] = await Promise.all([
    db.select().from(helpResources).orderBy(asc(helpResources.language), asc(helpResources.sort), asc(helpResources.name)),
    db.select().from(circles).orderBy(asc(circles.sort)),
  ])
  const circleSort = new Map(circleRows.map((c, i) => [c.id, i]))
  // Erst die allgemeinen, dann nach Kreis.
  const order = (h: Help) => (h.circleId ? 1 + (circleSort.get(h.circleId) ?? 0) : 0)
  return (
    <div className="stack">
      <h1 className="page-title">{m.admin.nav.help}</h1>
      <h2 className="eyebrow">Neue Nummer</h2>
      <HelpForm h={null} sort={rows.reduce((max, h) => Math.max(max, h.sort + 10), 0)} circles={circleRows} />
      {LANGS.map((l) => {
        const list = rows.filter((h) => h.language === l.code).sort((a, b) => order(a) - order(b))
        return (
          <section key={l.code} className="stack" aria-label={l.name}>
            <h2 className="eyebrow">
              {l.name} – <a href={l.page}>{l.page}</a> ({list.length})
            </h2>
            {list.length ? list.map((h) => <HelpForm key={h.id} h={h} sort={h.sort} circles={circleRows} />) : <p className="fine">Keine eigenen Einträge – es gelten die Standardnummern.</p>}
          </section>
        )
      })}
    </div>
  )
}

function HelpForm({ h, sort, circles }: { h: Help | null; sort: number; circles: Circle[] }) {
  const del = h ? `hilfe-loeschen-${h.id}` : ''
  return (
    <>
      <AdminForm action={saveHelp} className="card inline-form" label={h ? h.name : 'Neue Nummer'} resetOnSuccess={!h}>
        <input type="hidden" name="id" value={h?.id ?? ''} />
        <input className="input" name="name" defaultValue={h?.name} placeholder="Name" aria-label="Name" maxLength={80} required />
        <input className="input" name="phone" defaultValue={h?.phone ?? ''} placeholder="Nummer" aria-label="Nummer" inputMode="tel" maxLength={20} style={{ flex: '0 0 110px', minWidth: 110 }} />
        <input className="input" name="url" type="url" defaultValue={h?.url ?? ''} placeholder="https://…" aria-label="Link" />
        <input className="input" name="hours" defaultValue={h?.hours} placeholder="Zeiten" aria-label="Zeiten" maxLength={80} required />
        <input className="input" name="audience" defaultValue={h?.audience} placeholder="Für wen" aria-label="Für wen" maxLength={120} required />
        <select className="input" name="language" defaultValue={h?.language ?? 'de'} aria-label="Sprache (de: /hilfe, fr: /aide, it: /aiuto)" style={{ flex: '0 0 130px', minWidth: 130 }}>
          {LANGS.map((l) => (
            <option key={l.code} value={l.code}>
              {l.name}
            </option>
          ))}
        </select>
        <select className="input" name="circleId" defaultValue={h?.circleId ?? ''} aria-label="Kreis (Hilfe zu einem Thema)" style={{ flex: '0 0 170px', minWidth: 170 }}>
          <option value="">Allgemein (überall)</option>
          {circles.map((c) => (
            <option key={c.id} value={c.id}>
              Kreis: {c.name}
            </option>
          ))}
        </select>
        <input className="input" name="sort" type="number" min={0} max={999} defaultValue={sort} aria-label="Reihenfolge" style={{ flex: '0 0 80px', minWidth: 80 }} />
        <button className="btn small">{h ? m.common.save : 'Hinzufügen'}</button>
        {h && <DeleteButton form={del} message={`«${h.name}» aus der Hilfe löschen?`} />}
      </AdminForm>
      {h && (
        <AdminForm id={del} action={deleteHelp} label={`${h.name} löschen`} style={{ display: 'contents' }}>
          <input type="hidden" name="id" value={h.id} />
        </AdminForm>
      )}
    </>
  )
}

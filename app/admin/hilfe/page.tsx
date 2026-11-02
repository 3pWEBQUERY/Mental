import { asc } from 'drizzle-orm'
import { db } from '@/db'
import { helpResources } from '@/db/schema'
import { AdminForm, DeleteButton } from '@/components/admin/admin-form'
import { requireModerator } from '@/lib/server/admin'
import { m } from '@/messages'
import { deleteHelp, saveHelp } from '../actions'

type Help = typeof helpResources.$inferSelect

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
  const rows = await db.select().from(helpResources).orderBy(asc(helpResources.language), asc(helpResources.sort), asc(helpResources.name))
  return (
    <div className="stack">
      <h1 className="page-title">{m.admin.nav.help}</h1>
      <h2 className="eyebrow">Neue Nummer</h2>
      <HelpForm h={null} sort={rows.reduce((max, h) => Math.max(max, h.sort + 10), 0)} />
      {LANGS.map((l) => {
        const list = rows.filter((h) => h.language === l.code)
        return (
          <section key={l.code} className="stack" aria-label={l.name}>
            <h2 className="eyebrow">
              {l.name} – <a href={l.page}>{l.page}</a> ({list.length})
            </h2>
            {list.length ? list.map((h) => <HelpForm key={h.id} h={h} sort={h.sort} />) : <p className="fine">Keine eigenen Einträge – es gelten die Standardnummern.</p>}
          </section>
        )
      })}
    </div>
  )
}

function HelpForm({ h, sort }: { h: Help | null; sort: number }) {
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

import { asc } from 'drizzle-orm'
import { db } from '@/db'
import { helpResources } from '@/db/schema'
import { requireModerator } from '@/lib/server/admin'
import { m } from '@/messages'
import { saveHelp } from '../actions'

/** Hilfe-Nummern pflegen. Änderungen erneuern die statische Hilfe-Seite (cacheTag «help»). */
export default async function HelpAdmin() {
  await requireModerator('admin')
  const rows = await db.select().from(helpResources).orderBy(asc(helpResources.sort))
  return (
    <div className="stack">
      <h1 className="page-title">{m.admin.nav.help}</h1>
      {[...rows, null].map((h) => (
        <form key={h?.id ?? 'new'} action={saveHelp} className="card inline-form">
          <input type="hidden" name="id" value={h?.id ?? ''} />
          <input className="input" name="name" defaultValue={h?.name} placeholder="Name" aria-label="Name" required />
          <input className="input" name="phone" defaultValue={h?.phone ?? ''} placeholder="Nummer" aria-label="Nummer" style={{ flex: '0 0 110px', minWidth: 110 }} />
          <input className="input" name="url" defaultValue={h?.url ?? ''} placeholder="https://…" aria-label="Link" />
          <input className="input" name="hours" defaultValue={h?.hours} placeholder="Zeiten" aria-label="Zeiten" required />
          <input className="input" name="audience" defaultValue={h?.audience} placeholder="Für wen" aria-label="Für wen" required />
          <input className="input" name="sort" type="number" defaultValue={h?.sort ?? rows.length * 10} aria-label="Reihenfolge" style={{ flex: '0 0 80px', minWidth: 80 }} />
          <button className="btn small">{h ? m.common.save : 'Hinzufügen'}</button>
          {h && (
            <button className="btn ghost small" name="remove" value="1">
              {m.common.delete}
            </button>
          )}
        </form>
      ))}
    </div>
  )
}

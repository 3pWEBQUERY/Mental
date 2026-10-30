import { asc } from 'drizzle-orm'
import { db } from '@/db'
import { circles, steps } from '@/db/schema'
import { requireModerator } from '@/lib/server/admin'
import { m } from '@/messages'
import { saveStep } from '../actions'

export default async function StepsAdmin() {
  await requireModerator('admin')
  const [rows, circleRows] = await Promise.all([db.select().from(steps).orderBy(asc(steps.sort)), db.select().from(circles).orderBy(asc(circles.sort))])
  return (
    <div className="stack">
      <h1 className="page-title">{m.admin.nav.steps}</h1>
      {[...rows, null].map((s) => (
        <form key={s?.id ?? 'new'} action={saveStep} className="card inline-form">
          <input type="hidden" name="id" value={s?.id ?? ''} />
          <input className="input" name="text" defaultValue={s?.text} placeholder="Ein konkreter, machbarer Vorschlag" aria-label="Text" required style={{ flex: 3 }} />
          <select className="input" name="circleId" defaultValue={s?.circleId ?? ''} aria-label="Kreis">
            <option value="">Alle Kreise</option>
            {circleRows.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input className="input" name="sort" type="number" defaultValue={s?.sort ?? rows.length} aria-label="Reihenfolge" style={{ flex: '0 0 80px', minWidth: 80 }} />
          <label className="switch">
            <input type="checkbox" name="isActive" defaultChecked={s?.isActive ?? true} />
            <i />
            Aktiv
          </label>
          <button className="btn small">{s ? m.common.save : 'Hinzufügen'}</button>
        </form>
      ))}
    </div>
  )
}

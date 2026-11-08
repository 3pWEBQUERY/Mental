import { asc } from 'drizzle-orm'
import { db } from '@/db'
import { circles, steps } from '@/db/schema'
import { AdminForm, DeleteButton } from '@/components/admin/admin-form'
import { requireModerator } from '@/lib/server/admin'
import { m } from '@/messages'
import { deleteStep, saveStep } from '../actions'

type Step = typeof steps.$inferSelect
type Circle = typeof circles.$inferSelect

/** «Ein kleiner Schritt für heute»: anlegen, bearbeiten, löschen. Die App liest die Schritte direkt – sie gelten ab dem nächsten Laden. */
export default async function StepsAdmin() {
  await requireModerator('admin')
  const [rows, circleRows] = await Promise.all([
    db.select().from(steps).orderBy(asc(steps.sort), asc(steps.text)),
    db.select().from(circles).orderBy(asc(circles.sort)),
  ])
  const active = rows.filter((s) => s.isActive).length
  return (
    <div className="stack">
      <h1 className="page-title">{m.admin.nav.steps}</h1>
      <h2 className="eyebrow">Neuer Schritt</h2>
      <StepForm s={null} sort={rows.reduce((max, s) => Math.max(max, s.sort + 1), 0)} circles={circleRows} />
      <h2 className="eyebrow">
        Bestehende Schritte ({rows.length}, davon {active} aktiv)
      </h2>
      {rows.map((s) => (
        <StepForm key={s.id} s={s} sort={s.sort} circles={circleRows} />
      ))}
    </div>
  )
}

function StepForm({ s, sort, circles }: { s: Step | null; sort: number; circles: Circle[] }) {
  const del = s ? `schritt-loeschen-${s.id}` : ''
  return (
    <>
      <AdminForm action={saveStep} className="card inline-form" label={s ? `Schritt: ${s.text}` : 'Neuer Schritt'} resetOnSuccess={!s}>
        <input type="hidden" name="id" value={s?.id ?? ''} />
        <input className="input" name="text" defaultValue={s?.text} placeholder="Ein konkreter, machbarer Vorschlag" aria-label="Text" maxLength={200} required style={{ flex: 3 }} />
        <input className="input" lang="fr" name="textFr" defaultValue={s?.i18n.fr?.text} placeholder="En français" aria-label="Text auf Französisch" maxLength={200} style={{ flex: 3 }} />
        <input className="input" lang="it" name="textIt" defaultValue={s?.i18n.it?.text} placeholder="In italiano" aria-label="Text auf Italienisch" maxLength={200} style={{ flex: 3 }} />
        <input className="input" lang="en" name="textEn" defaultValue={s?.i18n.en?.text} placeholder="In English" aria-label="Text auf Englisch" maxLength={200} style={{ flex: 3 }} />
        <select className="input" name="circleId" defaultValue={s?.circleId ?? ''} aria-label="Kreis">
          <option value="">Alle Kreise</option>
          {circles.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input className="input" name="sort" type="number" min={0} max={999} defaultValue={sort} aria-label="Reihenfolge" style={{ flex: '0 0 80px', minWidth: 80 }} />
        <label className="switch">
          <input type="checkbox" name="isActive" defaultChecked={s?.isActive ?? true} />
          <i />
          Aktiv
        </label>
        <button className="btn small">{s ? m.common.save : 'Hinzufügen'}</button>
        {s && <DeleteButton form={del} message={`Schritt «${s.text}» löschen?`} />}
      </AdminForm>
      {s && (
        <AdminForm id={del} action={deleteStep} label="Schritt löschen" style={{ display: 'contents' }}>
          <input type="hidden" name="id" value={s.id} />
        </AdminForm>
      )}
    </>
  )
}

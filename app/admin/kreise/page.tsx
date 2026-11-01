import { asc } from 'drizzle-orm'
import { db } from '@/db'
import { circles } from '@/db/schema'
import { requireModerator } from '@/lib/server/admin'
import { m } from '@/messages'
import { saveCircle } from '../actions'

export default async function CirclesAdmin() {
  await requireModerator('admin')
  const rows = await db.select().from(circles).orderBy(asc(circles.sort))
  return (
    <div className="stack">
      <h1 className="page-title">{m.admin.nav.circles}</h1>
      {[...rows, null].map((c) => (
        <form key={c?.id ?? 'new'} action={saveCircle} className="card stack">
          <input type="hidden" name="id" value={c?.id ?? ''} />
          <div className="inline-form">
            <input className="input" name="name" defaultValue={c?.name} placeholder="Name" aria-label="Name" required />
            <input className="input" name="slug" defaultValue={c?.slug} placeholder="slug" aria-label="Slug" pattern="[a-z0-9-]{2,40}" required />
            <input className="input" name="color" type="color" defaultValue={c?.color ?? '#55694D'} aria-label="Farbe" style={{ flex: '0 0 64px', minWidth: 64, padding: 4 }} />
            <input className="input" name="sort" type="number" defaultValue={c?.sort ?? rows.length} aria-label="Reihenfolge" style={{ flex: '0 0 90px', minWidth: 90 }} />
          </div>
          <textarea className="input" name="description" defaultValue={c?.description} placeholder="Beschreibung" aria-label="Beschreibung" style={{ minHeight: 70 }} required />
          <textarea className="input" name="rules" defaultValue={c?.rules} placeholder="Hausregeln im Kreis" aria-label="Hausregeln" style={{ minHeight: 70 }} required />
          <div lang="fr" className="stack" style={{ gap: 8 }}>
            <input className="input" name="nameFr" defaultValue={c?.i18n.fr?.name} placeholder="Nom (français)" aria-label="Name auf Französisch" maxLength={40} />
            <textarea className="input" name="descriptionFr" defaultValue={c?.i18n.fr?.description} placeholder="Description (français)" aria-label="Beschreibung auf Französisch" style={{ minHeight: 60 }} maxLength={400} />
            <textarea className="input" name="rulesFr" defaultValue={c?.i18n.fr?.rules} placeholder="Règles du cercle (français)" aria-label="Hausregeln auf Französisch" style={{ minHeight: 60 }} maxLength={400} />
          </div>
          <div lang="it" className="stack" style={{ gap: 8 }}>
            <input className="input" name="nameIt" defaultValue={c?.i18n.it?.name} placeholder="Nome (italiano)" aria-label="Name auf Italienisch" maxLength={40} />
            <textarea className="input" name="descriptionIt" defaultValue={c?.i18n.it?.description} placeholder="Descrizione (italiano)" aria-label="Beschreibung auf Italienisch" style={{ minHeight: 60 }} maxLength={400} />
            <textarea className="input" name="rulesIt" defaultValue={c?.i18n.it?.rules} placeholder="Regole del cerchio (italiano)" aria-label="Hausregeln auf Italienisch" style={{ minHeight: 60 }} maxLength={400} />
          </div>
          <div className="row-actions">
            <label className="switch">
              <input type="checkbox" name="isActive" defaultChecked={c?.isActive ?? true} />
              <i />
              Aktiv
            </label>
            <button className="btn small">{c ? m.common.save : 'Kreis anlegen'}</button>
          </div>
        </form>
      ))}
    </div>
  )
}

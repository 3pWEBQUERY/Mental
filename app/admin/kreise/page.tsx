import { asc, count } from 'drizzle-orm'
import { db } from '@/db'
import { circles, posts } from '@/db/schema'
import { AdminForm, DeleteButton } from '@/components/admin/admin-form'
import { requireModerator } from '@/lib/server/admin'
import { m } from '@/messages'
import { deleteCircle, saveCircle } from '../actions'

type Circle = typeof circles.$inferSelect

/** Kreise anlegen, bearbeiten, löschen. Änderungen gelten sofort in der App, auf /regeln und in der iOS-App. */
export default async function CirclesAdmin() {
  await requireModerator('admin')
  const [rows, counts] = await Promise.all([
    db.select().from(circles).orderBy(asc(circles.sort), asc(circles.name)),
    db.select({ circleId: posts.circleId, n: count() }).from(posts).groupBy(posts.circleId),
  ])
  const postsIn = new Map(counts.map((c) => [c.circleId, c.n]))
  const nextSort = rows.reduce((max, c) => Math.max(max, c.sort + 1), 0)
  return (
    <div className="stack">
      <h1 className="page-title">{m.admin.nav.circles}</h1>
      <h2 className="eyebrow">Neuer Kreis</h2>
      <CircleForm c={null} sort={nextSort} />
      <h2 className="eyebrow">Bestehende Kreise ({rows.length})</h2>
      {rows.map((c) => (
        <CircleForm key={c.id} c={c} sort={c.sort} posts={postsIn.get(c.id) ?? 0} others={rows.filter((o) => o.id !== c.id)} />
      ))}
    </div>
  )
}

function CircleForm({ c, sort, posts = 0, others = [] }: { c: Circle | null; sort: number; posts?: number; others?: Circle[] }) {
  const del = c ? `kreis-loeschen-${c.id}` : ''
  return (
    <div className="card stack" data-circle={c?.slug ?? 'neu'}>
      <AdminForm action={saveCircle} className="stack" label={c ? `Kreis ${c.name}` : 'Neuer Kreis'} resetOnSuccess={!c}>
        <input type="hidden" name="id" value={c?.id ?? ''} />
        <div className="inline-form">
          <input className="input" name="name" defaultValue={c?.name} placeholder="Name" aria-label="Name" maxLength={40} required />
          <input className="input" name="slug" defaultValue={c?.slug} placeholder="kurzname" aria-label="Kurzname (Adresse)" pattern="[a-z0-9-]{2,40}" title="2–40 Zeichen: a–z, 0–9, Bindestrich" required />
          <input className="input" name="color" type="color" defaultValue={c?.color ?? '#55694D'} aria-label="Farbe" style={{ flex: '0 0 64px', minWidth: 64, padding: 4 }} />
          <input className="input" name="sort" type="number" min={0} max={999} defaultValue={sort} aria-label="Reihenfolge" style={{ flex: '0 0 90px', minWidth: 90 }} />
        </div>
        <textarea className="input" name="description" defaultValue={c?.description} placeholder="Beschreibung" aria-label="Beschreibung" style={{ minHeight: 70 }} maxLength={400} required />
        <textarea className="input" name="rules" defaultValue={c?.rules} placeholder="Hausregeln im Kreis" aria-label="Hausregeln" style={{ minHeight: 70 }} maxLength={400} required />
        <details>
          <summary className="fine">Übersetzungen (Französisch, Italienisch){c?.i18n.fr || c?.i18n.it ? '' : ' – fehlt noch, es gilt der deutsche Text'}</summary>
          <div className="stack" style={{ gap: 8, marginTop: 8 }}>
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
          </div>
        </details>
        <div className="row-actions">
          <label className="switch">
            <input type="checkbox" name="isActive" defaultChecked={c?.isActive ?? true} />
            <i />
            Aktiv
          </label>
          <button className="btn small">{c ? m.common.save : 'Kreis anlegen'}</button>
          {c && (
            <DeleteButton
              form={del}
              message={
                posts
                  ? `Kreis «${c.name}» löschen? Seine ${posts} Gedanken kommen in den unten gewählten Kreis.`
                  : `Kreis «${c.name}» löschen?`
              }
            />
          )}
        </div>
      </AdminForm>
      {c && (
        <AdminForm id={del} action={deleteCircle} className="inline-form" label={`Kreis ${c.name} löschen`}>
          <input type="hidden" name="id" value={c.id} />
          {posts > 0 && (
            <label className="fine" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              Beim Löschen: {posts} {posts === 1 ? 'Gedanke kommt' : 'Gedanken kommen'} in
              <select className="input" name="moveTo" defaultValue={others.find((o) => o.isActive)?.id} aria-label="Gedanken verschieben nach" style={{ width: 'auto' }}>
                {others.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                    {o.isActive ? '' : ' (inaktiv)'}
                  </option>
                ))}
              </select>
            </label>
          )}
        </AdminForm>
      )}
    </div>
  )
}

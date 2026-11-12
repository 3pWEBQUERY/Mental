import { asc } from 'drizzle-orm'
import { db } from '@/db'
import { circles, prompts } from '@/db/schema'
import { AdminForm, DeleteButton } from '@/components/admin/admin-form'
import { requireModerator } from '@/lib/server/admin'
import { m } from '@/messages'
import { deletePrompt, savePrompt } from '../actions'

type Prompt = typeof prompts.$inferSelect
type Circle = typeof circles.$inferSelect

/**
 * «Fragen vom Team»: Anstösse je Kreis anlegen, übersetzen, ein- und ausblenden, löschen. Sie erscheinen sichtbar als
 * Fragen des Teams im Kreis; wer antwortet, teilt einen eigenen Gedanken. Die App liest sie direkt – ab dem nächsten Laden.
 */
export default async function PromptsAdmin() {
  await requireModerator('admin')
  const [rows, circleRows] = await Promise.all([
    db.select().from(prompts).orderBy(asc(prompts.sort), asc(prompts.createdAt)),
    db.select().from(circles).orderBy(asc(circles.sort)),
  ])
  const active = rows.filter((p) => p.isActive).length
  const next = rows.reduce((max, p) => Math.max(max, p.sort + 1), 0)
  return (
    <div className="stack">
      <h1 className="page-title">{m.admin.nav.prompts}</h1>
      <p className="fine" style={{ maxWidth: '68ch' }}>
        Fragen erscheinen oben im Kreis als «Frage vom Team Jiaia», eine davon täglich wechselnd auch in «Alle». Wer darauf antwortet, teilt einen eigenen
        Gedanken – mit dem Hinweis, auf welche Frage er antwortet. Offen formulieren, ohne Ratschlag, ohne nach Details einer Krise zu fragen.
      </p>
      <h2 className="eyebrow">Neue Frage</h2>
      <PromptForm p={null} sort={next} circles={circleRows} />
      <h2 className="eyebrow">
        Bestehende Fragen ({rows.length}, davon {active} aktiv)
      </h2>
      {circleRows.map((c) => {
        const list = rows.filter((p) => p.circleId === c.id)
        if (!list.length) return null
        return (
          <section key={c.id} className="stack" aria-label={`Fragen im Kreis ${c.name}`} style={{ gap: 10 }}>
            <h3 className="admin-circle-head">
              <span className="dot" style={{ background: c.color }} aria-hidden="true" />
              {c.name}
              {!c.isActive && <span className="fine"> (Kreis ausgeblendet)</span>}
            </h3>
            {list.map((p) => (
              <PromptForm key={p.id} p={p} sort={p.sort} circles={circleRows} />
            ))}
          </section>
        )
      })}
    </div>
  )
}

function PromptForm({ p, sort, circles }: { p: Prompt | null; sort: number; circles: Circle[] }) {
  const del = p ? `frage-loeschen-${p.id}` : ''
  return (
    <>
      <AdminForm action={savePrompt} className="card inline-form" label={p ? `Frage: ${p.text}` : 'Neue Frage'} resetOnSuccess={!p}>
        <input type="hidden" name="id" value={p?.id ?? ''} />
        <input className="input" name="text" defaultValue={p?.text} placeholder="Eine offene Frage an den Kreis" aria-label="Frage" maxLength={200} required style={{ flex: 3 }} />
        <input className="input" lang="fr" name="textFr" defaultValue={p?.i18n.fr?.text} placeholder="En français" aria-label="Frage auf Französisch" maxLength={200} style={{ flex: 3 }} />
        <input className="input" lang="it" name="textIt" defaultValue={p?.i18n.it?.text} placeholder="In italiano" aria-label="Frage auf Italienisch" maxLength={200} style={{ flex: 3 }} />
        <input className="input" lang="en" name="textEn" defaultValue={p?.i18n.en?.text} placeholder="In English" aria-label="Frage auf Englisch" maxLength={200} style={{ flex: 3 }} />
        <select className="input" name="circleId" defaultValue={p?.circleId ?? ''} aria-label="Kreis" required>
          {!p && (
            <option value="" disabled>
              Kreis wählen
            </option>
          )}
          {circles.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input className="input" name="sort" type="number" min={0} max={999} defaultValue={sort} aria-label="Reihenfolge" style={{ flex: '0 0 80px', minWidth: 80 }} />
        <label className="switch">
          <input type="checkbox" name="isActive" defaultChecked={p?.isActive ?? true} />
          <i />
          Aktiv
        </label>
        <button className="btn small">{p ? m.common.save : 'Hinzufügen'}</button>
        {p && <DeleteButton form={del} message={`Frage «${p.text}» löschen? Gedanken, die darauf geantwortet haben, bleiben bestehen.`} />}
      </AdminForm>
      {p && (
        <AdminForm id={del} action={deletePrompt} label="Frage löschen" style={{ display: 'contents' }}>
          <input type="hidden" name="id" value={p.id} />
        </AdminForm>
      )}
    </>
  )
}

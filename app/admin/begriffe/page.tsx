import { asc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { crisisTerms } from '@/db/schema'
import { requireModerator } from '@/lib/server/admin'
import { m } from '@/messages'
import { saveTerm } from '../actions'

/** Wortliste für Stufe 1 (Browser) und Stufe 2 (Server), alle Sprachen gelten überall. Vor dem Launch von einer Fachperson abzunehmen. */
export default async function TermsAdmin() {
  await requireModerator('admin')
  const rows = await db
    .select()
    .from(crisisTerms)
    .where(eq(crisisTerms.active, true))
    .orderBy(asc(crisisTerms.language), asc(crisisTerms.level), asc(crisisTerms.term))
  return (
    <div className="stack">
      <h1 className="page-title">{m.admin.nav.terms}</h1>
      <form action={saveTerm} className="card inline-form">
        <input className="input" name="term" placeholder="Begriff oder Wendung (ganze Wörter; Akzente egal)" aria-label="Begriff" required />
        <select className="input" name="language" aria-label="Sprache" style={{ flex: '0 0 130px', minWidth: 130 }}>
          <option value="de">Deutsch</option>
          <option value="fr">Französisch</option>
          <option value="it">Italienisch</option>
        </select>
        <select className="input" name="level" aria-label="Stufe" style={{ flex: '0 0 140px', minWidth: 140 }}>
          <option value="acute">akut</option>
          <option value="concern">Sorge</option>
        </select>
        <button className="btn small">Hinzufügen</button>
      </form>
      <table className="table">
        <thead>
          <tr>
            <th>Begriff</th>
            <th>Sprache</th>
            <th>Stufe</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id}>
              <td lang={t.language}>{t.term}</td>
              <td>{t.language.toUpperCase()}</td>
              <td>{t.level === 'acute' ? 'akut' : 'Sorge'}</td>
              <td>
                <form action={saveTerm}>
                  <input type="hidden" name="id" value={t.id} />
                  <input type="hidden" name="term" value={t.term} />
                  <input type="hidden" name="level" value={t.level} />
                  <input type="hidden" name="language" value={t.language} />
                  <button className="btn ghost small" name="remove" value="1">
                    {m.common.delete}
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

import { asc, desc } from 'drizzle-orm'
import { db } from '@/db'
import { partnerMedia, partners } from '@/db/schema'
import { AdminForm, DeleteButton } from '@/components/admin/admin-form'
import { LogoUpload } from '@/components/admin/logo-upload'
import { requireModerator } from '@/lib/server/admin'
import { m } from '@/messages'
import { deletePartner, deletePartnerMedia, savePartner } from '../actions'

type Partner = typeof partners.$inferSelect
type Media = { id: string; name: string; width: number; height: number; bytes: number }

/**
 * Partner der Startseite (z. B. Die Dargebotene Hand, Pro Juventute) und ihre Logos. Jede Änderung erscheint sofort
 * auf der Startseite aller Web-Replikas (cacheTag «partners»).
 */
export default async function PartnerAdmin() {
  await requireModerator('admin')
  const [rows, media] = await Promise.all([
    db.select().from(partners).orderBy(asc(partners.sort), asc(partners.name)),
    db
      .select({ id: partnerMedia.id, name: partnerMedia.name, width: partnerMedia.width, height: partnerMedia.height, bytes: partnerMedia.bytes })
      .from(partnerMedia)
      .orderBy(desc(partnerMedia.createdAt)),
  ])
  const usedBy = new Map<string, string[]>()
  for (const p of rows) if (p.mediaId) usedBy.set(p.mediaId, [...(usedBy.get(p.mediaId) ?? []), p.name])
  return (
    <div className="stack">
      <h1 className="page-title">{m.admin.nav.partners}</h1>
      <p className="fine" style={{ maxWidth: 640 }}>
        Aktive Partner erscheinen auf der <a href="/">Startseite</a> unter «{m.landing.partners}» – mit Logo, sonst mit Namen. Logos nur mit Erlaubnis der
        Organisation verwenden.
      </p>

      <h2 className="eyebrow">Neuer Partner</h2>
      <PartnerForm p={null} sort={rows.reduce((max, p) => Math.max(max, p.sort + 10), 0)} media={media} />

      <section className="stack" aria-label="Partner">
        <h2 className="eyebrow">Partner ({rows.length})</h2>
        {rows.length ? rows.map((p) => (
          // Schlüssel mit Logo: Ein Upload mit «direkt zuweisen» ändert das Logo von aussen – das Auswahlfeld muss es übernehmen.
          <PartnerForm key={`${p.id}:${p.mediaId ?? ''}`} p={p} sort={p.sort} media={media} />
        )) : <p className="fine">Noch keine Partner – der Bereich ist auf der Startseite ausgeblendet.</p>}
      </section>

      <section className="stack" aria-label="Medien">
        <h2 className="eyebrow">Medien ({media.length})</h2>
        <p className="fine" style={{ maxWidth: 640 }}>
          PNG, JPEG, WebP, SVG, GIF oder AVIF bis 3 MB. Jedes Logo wird neu gerechnet (WebP, höchstens 800×400 px, ohne Metadaten; SVG wird gerastert) –
          am schärfsten mit einem SVG oder einem breiten PNG mit transparentem Hintergrund.
        </p>
        <LogoUpload partners={rows.map((p) => ({ id: p.id, name: p.name }))} />
        {media.length > 0 && (
          <ul className="partner-media" aria-label="Hochgeladene Logos">
            {media.map((x) => (
              <MediaItem key={x.id} x={x} usedBy={usedBy.get(x.id) ?? []} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function PartnerForm({ p, sort, media }: { p: Partner | null; sort: number; media: Media[] }) {
  const del = p ? `partner-loeschen-${p.id}` : ''
  const logo = p?.mediaId ? media.find((x) => x.id === p.mediaId) : undefined
  return (
    <>
      <AdminForm action={savePartner} className="card inline-form" label={p ? `Partner ${p.name}` : 'Neuer Partner'} resetOnSuccess={!p}>
        <input type="hidden" name="id" value={p?.id ?? ''} />
        {p && (
          <span className="partner-thumb" aria-hidden="true">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/partner-logo/${logo.id}`} alt="" width={logo.width} height={logo.height} />
            ) : (
              <span className="fine">ohne Logo</span>
            )}
          </span>
        )}
        <input className="input" name="name" defaultValue={p?.name} placeholder="Name" aria-label="Name" maxLength={80} required />
        <input className="input" name="url" type="url" defaultValue={p?.url ?? ''} placeholder="https://…" aria-label="Link zur Website" maxLength={300} />
        <select className="input" name="mediaId" defaultValue={p?.mediaId ?? ''} aria-label="Logo" style={{ flex: '0 0 200px', minWidth: 180 }}>
          <option value="">Ohne Logo (nur Name)</option>
          {media.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
        <input className="input" name="sort" type="number" min={0} max={999} defaultValue={sort} aria-label="Reihenfolge" style={{ flex: '0 0 80px', minWidth: 80 }} />
        <label className="switch">
          <input type="checkbox" name="isActive" defaultChecked={p ? p.isActive : true} />
          <i />
          Auf der Startseite
        </label>
        <button className="btn small">{p ? m.common.save : 'Hinzufügen'}</button>
        {p && <DeleteButton form={del} message={`Partner «${p.name}» löschen? Das Logo bleibt in den Medien.`} />}
      </AdminForm>
      {p && (
        <AdminForm id={del} action={deletePartner} label={`${p.name} löschen`} style={{ display: 'contents' }}>
          <input type="hidden" name="id" value={p.id} />
        </AdminForm>
      )}
    </>
  )
}

function MediaItem({ x, usedBy }: { x: Media; usedBy: string[] }) {
  const del = `logo-loeschen-${x.id}`
  return (
    <li className="card partner-media-item">
      <a className="partner-thumb" href={`/api/partner-logo/${x.id}`} target="_blank" rel="noreferrer" aria-label={`${x.name} in voller Grösse`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/partner-logo/${x.id}`} alt="" width={x.width} height={x.height} loading="lazy" />
      </a>
      <span className="partner-media-name">{x.name}</span>
      <span className="fine">
        {x.width}×{x.height} · {Math.max(1, Math.round(x.bytes / 1024))} KB · {usedBy.length ? `genutzt von ${usedBy.join(', ')}` : 'nicht genutzt'}
      </span>
      <DeleteButton
        form={del}
        message={usedBy.length ? `«${x.name}» löschen? ${usedBy.join(', ')} erscheint dann ohne Logo.` : `«${x.name}» löschen?`}
      />
      <AdminForm id={del} action={deletePartnerMedia} label={`${x.name} löschen`} style={{ display: 'contents' }}>
        <input type="hidden" name="id" value={x.id} />
      </AdminForm>
    </li>
  )
}

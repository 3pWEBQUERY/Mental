import { sql } from 'drizzle-orm'
import { db } from '../../db'
import { JOURNAL_PREFIX } from '../../lib/deletion-journal'
import { bucketConfigured, deleteObject, listKeys } from '../../lib/s3'

/**
 * Aufbewahrungsfristen (Datenschutzerklärung, README):
 * - Erledigte Meldungen: nach 12 Monaten ohne Notiz und ohne meldende Person (die Zahl bleibt für die Statistik).
 * - Gelöschte Gedanken: Die leere Zeile (Konto, Stimmung, Bedürfnis, Krisenstufe, Moderationsnotiz) verschwindet
 *   nach 30 Tagen ganz.
 * - Audit-Log der Moderation: 24 Monate, danach gelöscht (der Datenbank-Trigger erlaubt nur das).
 * - Lösch-Journal im Bucket: 60 Tage.
 */
export async function applyRetention() {
  const reports = await db.execute(sql`
    UPDATE reports SET note = NULL, reporter_id = NULL
    WHERE status <> 'open' AND created_at < now() - interval '12 months' AND (note IS NOT NULL OR reporter_id IS NOT NULL)`)
  const posts = await db.execute(sql`DELETE FROM posts WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days'`)
  const audit = await db.execute(sql`DELETE FROM moderation_actions WHERE created_at < now() - interval '24 months'`)
  let journal = 0
  if (bucketConfigured()) {
    const cutoff = Date.now() - 60 * 24 * 60 * 60 * 1000
    for (const o of await listKeys(JOURNAL_PREFIX)) {
      if (o.modified && o.modified.getTime() < cutoff) {
        await deleteObject(o.key).catch(() => {})
        journal++
      }
    }
  }
  const n = (reports.rowCount ?? 0) + (posts.rowCount ?? 0) + (audit.rowCount ?? 0) + journal
  if (n) console.log(`[retention] Meldungen ${reports.rowCount ?? 0}, Gedanken ${posts.rowCount ?? 0}, Audit ${audit.rowCount ?? 0}, Journal ${journal}`)
}

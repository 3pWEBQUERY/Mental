import { sql } from 'drizzle-orm'
import { db } from '../../db'
import { bucketConfigured, deleteObject, listKeys } from '../../lib/s3'

/** IP-Hashes und Zähler sind nach 24 Stunden weg. */
export async function cleanupRateLimits() {
  await db.execute(sql`DELETE FROM rate_limits WHERE window_start < now() - interval '24 hours'`)
}

/** Benachrichtigungen werden nach 30 Tagen gelöscht. */
export async function cleanupNotifications() {
  await db.execute(sql`DELETE FROM notifications WHERE created_at < now() - interval '30 days'`)
  await db.execute(sql`DELETE FROM sessions WHERE expires_at < now()`)
  await db.execute(sql`DELETE FROM reserved_usernames WHERE until < now()`)
}

/** «Gerade hier» braucht nur die letzten 15 Minuten. */
export async function cleanupPresence() {
  await db.execute(sql`DELETE FROM circle_presence WHERE seen_at < now() - interval '1 hour'`)
}

export async function cleanupExports() {
  const res = await db.execute<{ id: string; bucket_key: string | null }>(
    sql`DELETE FROM exports WHERE (expires_at < now()) OR (status <> 'ready' AND created_at < now() - interval '2 days') RETURNING id, bucket_key`,
  )
  if (!bucketConfigured()) return
  for (const r of res.rows) if (r.bucket_key) await deleteObject(r.bucket_key).catch(() => {})
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Nachlese im Bucket (täglich): Dateien, zu denen es keinen gültigen Eintrag mehr gibt – z. B. weil ein Löschen
 * beim Speicher kurz scheiterte (die Löschpfade schlucken solche Fehler, damit Konto- und Gedanken-Löschung
 * nie hängen bleiben). Nur Dateien, die älter als 6 Stunden sind: Uploads und Bildverarbeitung laufen gerade.
 */
export async function sweepBucket() {
  if (!bucketConfigured()) return
  const cutoff = Date.now() - 6 * 60 * 60 * 1000
  const old = (prefix: string) => listKeys(prefix).then((l) => l.filter((o) => (o.modified?.getTime() ?? 0) < cutoff))
  const [quarantine, media, exportFiles] = await Promise.all([old('quarantine/'), old('media/'), old('exports/')])

  const idOf = (key: string, prefix: string) => key.slice(prefix.length).split('.')[0]!
  const mediaIds = [...new Set([...quarantine.map((o) => idOf(o.key, 'quarantine/')), ...media.map((o) => idOf(o.key, 'media/'))])].filter((id) => UUID.test(id))
  const alive = new Set<string>()
  for (let i = 0; i < mediaIds.length; i += 500) {
    const chunk = mediaIds.slice(i, i + 500)
    const rows = await db.execute<{ id: string }>(sql`SELECT id FROM post_media WHERE id = ANY(${chunk}::uuid[]) AND status <> 'rejected'`)
    for (const r of rows.rows) alive.add(r.id)
  }
  const exportKeys = new Set(
    (await db.execute<{ bucket_key: string }>(sql`SELECT bucket_key FROM exports WHERE bucket_key IS NOT NULL`)).rows.map((r) => r.bucket_key),
  )
  const orphans = [
    ...quarantine.filter((o) => !alive.has(idOf(o.key, 'quarantine/'))),
    ...media.filter((o) => !alive.has(idOf(o.key, 'media/'))),
    ...exportFiles.filter((o) => !exportKeys.has(o.key)),
  ]
  let failed = 0
  for (const o of orphans) await deleteObject(o.key).catch(() => failed++)
  if (orphans.length) console.log(`[bucket] ${orphans.length - failed} verwaiste Dateien entfernt${failed ? `, ${failed} fehlgeschlagen (nächster Lauf)` : ''}`)
}

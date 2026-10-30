import { sql } from 'drizzle-orm'
import { db } from '../../db'
import { bucketConfigured, deleteObject } from '../../lib/s3'

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

import 'server-only'
import { sql } from 'drizzle-orm'
import { headers } from 'next/headers'
import { db } from '@/db'
import { hmac } from './crypto'
import { zurichDay } from '../time'

export type LimitResult = { ok: boolean; count: number; resetAt: Date }

/** Festes Fenster in Postgres – funktioniert über alle Replikas hinweg. */
export async function hit(key: string, max: number, windowMs: number): Promise<LimitResult> {
  const seconds = Math.ceil(windowMs / 1000)
  const res = await db.execute<{ count: number; window_start: Date }>(sql`
    INSERT INTO rate_limits (key, window_start, count) VALUES (${key}, now(), 1)
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN rate_limits.window_start < now() - make_interval(secs => ${seconds}) THEN 1 ELSE rate_limits.count + 1 END,
      window_start = CASE WHEN rate_limits.window_start < now() - make_interval(secs => ${seconds}) THEN now() ELSE rate_limits.window_start END
    RETURNING count, window_start`)
  const row = res.rows[0]!
  const resetAt = new Date(new Date(row.window_start).getTime() + windowMs)
  return { ok: row.count <= max, count: row.count, resetAt }
}

export async function peek(key: string, windowMs: number): Promise<number> {
  const res = await db.execute<{ count: number }>(sql`
    SELECT count FROM rate_limits WHERE key = ${key} AND window_start >= now() - make_interval(secs => ${Math.ceil(windowMs / 1000)})`)
  return res.rows[0]?.count ?? 0
}

export async function clear(key: string) {
  await db.execute(sql`DELETE FROM rate_limits WHERE key = ${key}`)
}

/**
 * IP gesalzen gehasht, das Salz wechselt täglich. Nach 24 Stunden ist ein Hash keiner IP mehr zuzuordnen;
 * der Aufräumjob löscht die Zeilen.
 */
export async function ipHash(): Promise<string> {
  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown'
  return hmac(ip, `ip:${zurichDay()}`).slice(0, 32)
}

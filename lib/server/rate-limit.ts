import 'server-only'
import { sql } from 'drizzle-orm'
import { headers } from 'next/headers'
import { db } from '@/db'
import { clientIp, ipBucket } from '../client-ip'
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
 * IP gesalzen gehasht (IPv6: das /64-Netz), das Salz wechselt täglich. Nach 24 Stunden ist ein Hash keiner IP mehr zuzuordnen;
 * der Aufräumjob löscht die Zeilen.
 */
export async function ipHash(): Promise<string> {
  return (await ipHashes()).today
}

/** Heutiger und gestriger Hash derselben Herkunft – damit Limits um Mitternacht nicht neu beginnen. */
export type IpHashes = { today: string; yesterday: string }

export async function ipHashes(): Promise<IpHashes> {
  const bucket = ipBucket(clientIp(await headers()))
  const yesterday = zurichDay(new Date(Date.now() - 24 * 60 * 60 * 1000))
  return { today: hmac(bucket, `ip:${zurichDay()}`).slice(0, 32), yesterday: hmac(bucket, `ip:${yesterday}`).slice(0, 32) }
}

/**
 * Limit je Herkunft über den Salzwechsel hinweg: gezählt wird unter dem heutigen Hash, angerechnet wird zusätzlich,
 * was unter dem gestrigen im selben Fenster schon zusammengekommen ist.
 */
export async function hitIp(key: (ip: string) => string, ips: IpHashes, max: number, windowMs: number): Promise<LimitResult> {
  const [now, before] = await Promise.all([hit(key(ips.today), max, windowMs), peek(key(ips.yesterday), windowMs)])
  const count = now.count + before
  return { ...now, count, ok: count <= max }
}

export async function peekIp(key: (ip: string) => string, ips: IpHashes, windowMs: number): Promise<number> {
  const [a, b] = await Promise.all([peek(key(ips.today), windowMs), peek(key(ips.yesterday), windowMs)])
  return a + b
}

export async function clearIp(key: (ip: string) => string, ips: IpHashes) {
  await Promise.all([clear(key(ips.today)), clear(key(ips.yesterday))])
}

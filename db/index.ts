import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

declare global {
  var __lichtungPool: Pool | undefined
}

/**
 * Grenzen, damit eine einzelne langsame Abfrage oder eine volle Datenbank nicht den ganzen Server lahmlegt:
 * - connectionTimeoutMillis: höchstens so lange auf eine Verbindung warten (auch, wenn der Pool voll ist).
 * - statement_timeout: keine Abfrage läuft länger (Skripte und Worker können es per Umgebung erhöhen).
 * - idle_in_transaction_session_timeout: eine hängende Transaktion hält keine Sperren für immer.
 */
const STATEMENT_TIMEOUT_MS = Number(process.env.DB_STATEMENT_TIMEOUT_MS ?? 20_000)

function createPool() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL fehlt')
  const p = new Pool({
    connectionString: url,
    max: Number(process.env.DB_POOL_MAX ?? 10),
    connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT_MS ?? 10_000),
    idleTimeoutMillis: 30_000,
    keepAlive: true,
    options: `-c statement_timeout=${STATEMENT_TIMEOUT_MS} -c idle_in_transaction_session_timeout=60000`,
  })
  // Ohne Handler beendet ein Fehler auf einer ruhenden Verbindung (z. B. Neustart der Datenbank) den ganzen Prozess.
  p.on('error', (e) => console.error('[db] Verbindung verloren:', e.message.slice(0, 160)))
  return p
}

// Im Dev-Server überlebt der Pool Hot-Reloads.
export const pool: Pool = globalThis.__lichtungPool ?? createPool()
if (process.env.NODE_ENV !== 'production') globalThis.__lichtungPool = pool

export const db: NodePgDatabase<typeof schema> = drizzle(pool, { schema })
export type Db = typeof db
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]
export { schema }

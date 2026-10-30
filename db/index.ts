import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

declare global {
  var __lichtungPool: Pool | undefined
}

function createPool() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL fehlt')
  return new Pool({ connectionString: url, max: Number(process.env.DB_POOL_MAX ?? 10) })
}

// Im Dev-Server überlebt der Pool Hot-Reloads.
export const pool: Pool = globalThis.__lichtungPool ?? createPool()
if (process.env.NODE_ENV !== 'production') globalThis.__lichtungPool = pool

export const db: NodePgDatabase<typeof schema> = drizzle(pool, { schema })
export type Db = typeof db
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]
export { schema }

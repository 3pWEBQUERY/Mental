import { defineConfig } from 'drizzle-kit'

function withLockTimeout(raw: string) {
  const url = new URL(raw)
  url.searchParams.set('options', '-c lock_timeout=10s')
  return url.toString()
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './db/schema.ts',
  out: './db/migrations',
  // lock_timeout: Eine Migration, die eine Tabelle nicht sofort sperren kann, bricht nach 10 s ab (der Deploy
  // scheitert und lässt sich wiederholen), statt hinter laufenden Abfragen zu warten und dabei alle weiteren
  // Abfragen auf dieser Tabelle zu blockieren – das liesse die laufende Seite einfrieren.
  dbCredentials: { url: withLockTimeout(process.env.DATABASE_URL ?? 'postgres://lichtung:lichtung@localhost:5432/lichtung') },
  strict: true,
})

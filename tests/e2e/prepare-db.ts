/**
 * Frische Test-Datenbank pro Lauf (aufgerufen aus playwright.config.ts, bevor der Web-Server startet):
 * neu anlegen, migrieren, seeden.
 */
import { execSync } from 'node:child_process'
import { Client } from 'pg'

const target = new URL(process.env.DATABASE_URL!)
const name = target.pathname.slice(1)
if (!name.endsWith('_e2e')) throw new Error(`E2E-Datenbank muss auf _e2e enden, ist «${name}»`)
const admin = new Client({ connectionString: process.env.E2E_ADMIN_DATABASE_URL })
await admin.connect()
await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`)
await admin.query(`CREATE DATABASE "${name}"`)
await admin.end()
execSync('npx drizzle-kit migrate && npx tsx db/seed.ts', { stdio: 'inherit', env: process.env })

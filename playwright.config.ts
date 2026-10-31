import { execSync } from 'node:child_process'
import { defineConfig, devices } from '@playwright/test'

/**
 * E2E gegen einen Produktions-Build: `npm run build` vorher.
 * Datenbank: Jeder Lauf bekommt eine frische eigene Datenbank «<name>_e2e» neben DATABASE_URL.
 * Angelegt wird sie hier beim Laden der Konfiguration – Playwright startet den webServer noch vor
 * globalSetup, und dessen Health-Check braucht die Datenbank schon. Die Datei wird auch in den
 * Test-Prozessen geladen; die Umgebungsvariable sorgt dafür, dass das nur einmal passiert.
 */
const PORT = Number(process.env.E2E_PORT ?? 3100)
if (!process.env.E2E_ADMIN_DATABASE_URL) {
  const base = process.env.DATABASE_URL ?? 'postgres://lichtung:lichtung@localhost:5432/lichtung'
  const e2e = new URL(base)
  e2e.pathname = `${e2e.pathname}_e2e`
  process.env.E2E_ADMIN_DATABASE_URL = base
  process.env.DATABASE_URL = e2e.toString()
  execSync('npx tsx tests/e2e/prepare-db.ts', { stdio: 'inherit', env: process.env })
}

export default defineConfig({
  testDir: 'tests/e2e',
  // Tests mit zwei Konten registrieren doppelt (Argon2) – gegen Ende eines vollen Laufs wird es eng.
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure', locale: 'de-CH', timezoneId: 'Europe/Zurich' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }, testIgnore: /mobile\.spec\.ts/ },
    { name: 'mobil', use: { ...devices['Pixel 7'] }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    // Nie wiederverwenden: Jeder Lauf legt die Test-Datenbank neu an – ein alter Server hielte gekappte Verbindungen.
    reuseExistingServer: false,
    // APP_URL passend zum Port: Passkeys prüfen die Herkunft (origin) genau.
    env: { HIBP_DISABLED: '1', REGISTRATIONS_PER_IP_PER_DAY: '1000', USERNAME_CHECKS_PER_10_MIN: '1000', APP_URL: `http://localhost:${PORT}` },
  },
})

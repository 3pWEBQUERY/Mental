import { defineConfig, devices } from '@playwright/test'

/**
 * E2E gegen einen Produktions-Build: `npm run build` vorher.
 * Datenbank: DATABASE_URL (Migrationen + Seed laufen im globalSetup).
 */
const PORT = Number(process.env.E2E_PORT ?? 3100)

export default defineConfig({
  testDir: 'tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  timeout: 60_000,
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
    reuseExistingServer: !process.env.CI,
    env: { HIBP_DISABLED: '1', REGISTRATIONS_PER_IP_PER_DAY: '1000' },
  },
})

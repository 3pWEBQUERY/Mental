import { execSync } from 'node:child_process'

export default function globalSetup() {
  execSync('npx drizzle-kit migrate && npx tsx db/seed.ts', { stdio: 'inherit' })
}

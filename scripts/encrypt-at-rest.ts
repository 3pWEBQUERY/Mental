/**
 * Bestehende Klartext-Werte nachträglich verschlüsseln (nach dem Setzen von DATA_ENCRYPTION_KEY,
 * beliebig oft wiederholbar; auch nach einem Schlüsselwechsel). Läuft im Pre-Deploy des
 * web-Service mit; ohne Schlüssel tut es nichts.
 *   DATA_ENCRYPTION_KEY=… npm run data:encrypt
 */
import { pool } from '../db'
import { reencryptAtRest } from '../lib/reencrypt'

const main = () => reencryptAtRest()

main()
  .catch((e) => {
    console.error('[encrypt] fehlgeschlagen:', (e as Error).message)
    process.exitCode = 1
  })
  .finally(() => pool.end())

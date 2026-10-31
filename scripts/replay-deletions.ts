/**
 * Nach einem Restore der Datenbank aus einem Backup: alle Löschungen seit dem Backup erneut ausführen –
 * sonst wären gelöschte Konten und losgelassene oder gelöschte Gedanken wieder da (DSG: Löschung muss gelten).
 *   npm run data:replay-deletions -- 2026-10-30      (Datum des Backups, im Zweifel einen Tag früher)
 * Das Journal liegt im Bucket (lib/deletion-journal.ts), nicht in der Datenbank, und überlebt den Restore.
 */
import { pool } from '../db'
import { hardDeletePost } from '../lib/post-delete'
import { JOURNAL_PREFIX } from '../lib/deletion-journal'
import { bucketConfigured, getObjectBytes, listKeys } from '../lib/s3'
import { purgeAccount } from '../worker/jobs/account'

async function main() {
  const since = process.argv[2]
  if (!since || Number.isNaN(Date.parse(since))) throw new Error('Aufruf: npm run data:replay-deletions -- JJJJ-MM-TT (Datum des Backups)')
  if (!bucketConfigured()) throw new Error('Kein Bucket konfiguriert – ohne Journal nichts abzuspielen')
  const keys = (await listKeys(JOURNAL_PREFIX)).map((o) => o.key).filter((k) => k.slice(JOURNAL_PREFIX.length, JOURNAL_PREFIX.length + 10) >= since)
  let posts = 0
  let accounts = 0
  for (const key of keys.sort()) {
    const e = JSON.parse(Buffer.from(await getObjectBytes(key)).toString()) as { kind: 'post' | 'account'; id: string }
    if (e.kind === 'post' && (await hardDeletePost(e.id))) posts++
    if (e.kind === 'account') {
      await purgeAccount({ userId: e.id, reason: 'replay' })
      accounts++
    }
  }
  console.log(`[replay] ${keys.length} Einträge seit ${since}: ${posts} Gedanken, ${accounts} Konten erneut gelöscht`)
}

main()
  .catch((e) => {
    console.error('[replay] fehlgeschlagen:', (e as Error).message)
    process.exitCode = 1
  })
  .finally(() => pool.end())

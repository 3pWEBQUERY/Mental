/**
 * Nach einem Restore der Datenbank aus einem Backup: alle Löschungen seit dem Backup erneut ausführen –
 * sonst wären gelöschte Konten, Antworten, Briefe, Tagebucheinträge, Notfallpläne und Löschanträge wieder da
 * (DSG: Löschung muss gelten; Datenschutzerklärung: «gelöscht bleibt gelöscht»).
 *   npm run data:replay-deletions -- 2026-10-30      (Datum des Backups, im Zweifel einen Tag früher)
 * Das Journal liegt im Bucket (lib/deletion-journal.ts), nicht in der Datenbank, und überlebt den Restore.
 * Die Einträge laufen in zeitlicher Reihenfolge ab (Antrag → Abbruch → neuer Antrag ergibt den letzten Stand).
 */
import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import { db, pool } from '../db'
import { journalEntries, letters, profiles, replies, reports, safetyPlans, users } from '../db/schema'
import { JOURNAL_PREFIX, type DeletionKind } from '../lib/deletion-journal'
import { hardDeletePost } from '../lib/post-delete'
import { syncReplyCount } from '../lib/reply-count'
import { bucketConfigured, getObjectBytes, listKeys } from '../lib/s3'
import { purgeAccount } from '../worker/jobs/account'

type Entry = { kind: DeletionKind; id: string; at?: string; deleteAfter?: string }

async function replay(e: Entry): Promise<boolean> {
  switch (e.kind) {
    case 'post':
      return hardDeletePost(e.id)
    case 'reply': {
      const [r] = await db
        .update(replies)
        .set({ body: '', deletedAt: new Date() })
        .where(and(eq(replies.id, e.id), isNull(replies.deletedAt)))
        .returning({ postId: replies.postId })
      if (!r) return false
      await db
        .update(reports)
        .set({ status: 'dismissed', resolvedAt: new Date() })
        .where(and(eq(reports.targetType, 'reply'), eq(reports.targetId, e.id), eq(reports.status, 'open')))
      await syncReplyCount(r.postId)
      return true
    }
    case 'letter':
      return (await db.delete(letters).where(eq(letters.id, e.id)).returning({ id: letters.id })).length > 0
    case 'journal':
      return (await db.delete(journalEntries).where(eq(journalEntries.id, e.id)).returning({ id: journalEntries.id })).length > 0
    case 'journal-reset': {
      const n = await db.delete(journalEntries).where(eq(journalEntries.userId, e.id)).returning({ id: journalEntries.id })
      await db.update(profiles).set({ settings: sql`${profiles.settings} - 'journalSalt' - 'journalCheck'` }).where(eq(profiles.userId, e.id))
      return n.length > 0
    }
    case 'safety-plan':
      return (await db.delete(safetyPlans).where(eq(safetyPlans.userId, e.id)).returning({ id: safetyPlans.userId })).length > 0
    case 'account-request': {
      if (!e.deleteAfter || Number.isNaN(Date.parse(e.deleteAfter))) return false
      // Gesperrte Konten bleiben, wie sie sind (eine Sperre nach dem Antrag hätte ihn ohnehin überholt).
      const r = await db
        .update(users)
        .set({ status: 'deleting', deleteAfter: new Date(e.deleteAfter) })
        .where(and(eq(users.id, e.id), inArray(users.status, ['active', 'muted'])))
        .returning({ id: users.id })
      return r.length > 0
    }
    case 'account-cancel': {
      const r = await db
        .update(users)
        .set({ status: sql`CASE WHEN ${users.mutedUntil} > now() THEN 'muted'::user_status ELSE 'active'::user_status END`, deleteAfter: null })
        .where(and(eq(users.id, e.id), eq(users.status, 'deleting')))
        .returning({ id: users.id })
      return r.length > 0
    }
    case 'account':
      await purgeAccount({ userId: e.id, reason: 'replay' })
      return true
  }
}

async function main() {
  const since = process.argv[2]
  // Nur ein reines Datum: Mit Uhrzeit fiele der Tag des Backups selbst aus dem Vergleich der Schlüssel.
  if (!since || !/^\d{4}-\d{2}-\d{2}$/.test(since) || Number.isNaN(Date.parse(since)))
    throw new Error('Aufruf: npm run data:replay-deletions -- JJJJ-MM-TT (Datum des Backups)')
  if (!bucketConfigured()) throw new Error('Kein Bucket konfiguriert – ohne Journal nichts abzuspielen')
  const keys = (await listKeys(JOURNAL_PREFIX)).map((o) => o.key).filter((k) => k.slice(JOURNAL_PREFIX.length, JOURNAL_PREFIX.length + 10) >= since)
  const entries: Entry[] = []
  for (const key of keys) entries.push(JSON.parse(Buffer.from(await getObjectBytes(key)).toString()) as Entry)
  // Zeitliche Reihenfolge (ältere Einträge ohne Zeitstempel im Namen sortieren über «at»).
  entries.sort((a, b) => (Date.parse(a.at ?? '') || 0) - (Date.parse(b.at ?? '') || 0))
  const counts = new Map<string, number>()
  for (const e of entries) if (await replay(e)) counts.set(e.kind, (counts.get(e.kind) ?? 0) + 1)
  console.log(`[replay] ${entries.length} Einträge seit ${since}: ${[...counts].map(([k, n]) => `${k} ${n}`).join(', ') || 'nichts zu tun'}`)
}

main()
  .catch((e) => {
    console.error('[replay] fehlgeschlagen:', (e as Error).message)
    process.exitCode = 1
  })
  .finally(() => pool.end())

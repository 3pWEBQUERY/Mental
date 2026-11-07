import { bucketConfigured, putObject } from './s3'
import { safeMessage } from './log-safe'

/**
 * Lösch-Journal – bewusst im Bucket, nicht in der Datenbank. Wird die Datenbank aus einem Backup
 * wiederhergestellt, kämen gelöschte Konten und losgelassene oder gelöschte Gedanken sonst zurück.
 * Nach einem Restore spielt `npm run data:replay-deletions` alle Einträge seit dem Backup erneut ab.
 * Gespeichert wird nur Art, ID und Zeitpunkt – kein Inhalt. Einträge werden nach 60 Tagen entfernt
 * (länger als jede Backup-Aufbewahrung).
 */
/**
 * post / reply / letter / journal: die ID des Eintrags. journal-reset / safety-plan / account / account-request /
 * account-cancel: die Konto-ID. account-request trägt das Löschdatum (deleteAfter) mit.
 */
export type DeletionKind = 'post' | 'reply' | 'letter' | 'journal' | 'journal-reset' | 'safety-plan' | 'account' | 'account-request' | 'account-cancel'
export const JOURNAL_PREFIX = 'deletions/'

export async function journalDeletion(kind: DeletionKind, id: string, extra?: { deleteAfter?: string }) {
  if (!bucketConfigured()) return
  const at = new Date()
  // Zeitstempel im Namen: Ein Konto kann Löschung beantragen, abbrechen und neu beantragen – alles zählt, in Reihenfolge.
  const key = `${JOURNAL_PREFIX}${at.toISOString().slice(0, 10)}/${at.getTime()}-${kind}-${id}.json`
  await putObject(key, Buffer.from(JSON.stringify({ kind, id, at: at.toISOString(), ...extra })), 'application/json').catch((e) =>
    console.error('[journal] Eintrag fehlgeschlagen:', safeMessage(e)),
  )
}

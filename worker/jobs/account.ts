import { and, eq, inArray, isNotNull, lt, or, sql } from 'drizzle-orm'
import { strToU8, zipSync, type Zippable } from 'fflate'
import { db } from '../../db'
import {
  blocks,
  bookmarks,
  breathLog,
  checkins,
  circlePrefs,
  circles,
  exports,
  journalEntries,
  postMedia,
  posts,
  profiles,
  replies,
  reservedUsernames,
  sessions,
  stepLog,
  support,
  users,
} from '../../db/schema'
import { bucketConfigured, deleteObject, getObjectBytes, putObject } from '../../lib/s3'

const DAY = 24 * 60 * 60 * 1000

/** ZIP mit allen Daten des Kontos (JSON + eigene Bilder), 24 Stunden über einen signierten Link abrufbar. */
export async function exportAccount({ exportId }: { exportId: string }) {
  const [job] = await db.select().from(exports).where(eq(exports.id, exportId))
  if (!job || job.status !== 'pending') return
  const userId = job.userId
  try {
    const [user] = await db
      .select({ username: users.username, createdAt: users.createdAt, ageConfirmedAt: users.ageConfirmedAt, role: users.role })
      .from(users)
      .where(eq(users.id, userId))
    const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId))
    const myPosts = await db
      .select({ id: posts.id, circle: circles.name, need: posts.need, mood: posts.mood, body: posts.body, visibility: posts.visibility, authorHandle: posts.authorHandle, contentWarning: posts.contentWarning, status: posts.status, createdAt: posts.createdAt, editedAt: posts.editedAt })
      .from(posts)
      .innerJoin(circles, eq(circles.id, posts.circleId))
      .where(and(eq(posts.userId, userId), sql`${posts.deletedAt} IS NULL`))
    const [myReplies, myCheckins, journal, given, marks, prefs, breaths, stepsDone, blocked, media] = await Promise.all([
      db.select({ postId: replies.postId, body: replies.body, authorHandle: replies.authorHandle, createdAt: replies.createdAt }).from(replies).where(eq(replies.userId, userId)),
      db.select({ mood: checkins.mood, note: checkins.note, createdAt: checkins.createdAt }).from(checkins).where(eq(checkins.userId, userId)),
      db.select({ ciphertext: journalEntries.ciphertext, iv: journalEntries.iv, salt: journalEntries.salt, createdAt: journalEntries.createdAt }).from(journalEntries).where(eq(journalEntries.userId, userId)),
      db.select({ postId: support.postId, kind: support.kind, createdAt: support.createdAt }).from(support).where(eq(support.userId, userId)),
      db.select({ postId: bookmarks.postId, createdAt: bookmarks.createdAt }).from(bookmarks).where(eq(bookmarks.userId, userId)),
      db.select({ circle: circles.name, state: circlePrefs.state }).from(circlePrefs).innerJoin(circles, eq(circles.id, circlePrefs.circleId)).where(eq(circlePrefs.userId, userId)),
      db.select({ seconds: breathLog.seconds, createdAt: breathLog.createdAt }).from(breathLog).where(eq(breathLog.userId, userId)),
      db.select({ action: stepLog.action, createdAt: stepLog.createdAt }).from(stepLog).where(eq(stepLog.userId, userId)),
      db.select({ createdAt: blocks.createdAt }).from(blocks).where(eq(blocks.blockerId, userId)),
      db.select({ id: postMedia.id, key: postMedia.bucketKey, postId: postMedia.postId }).from(postMedia).where(and(eq(postMedia.userId, userId), eq(postMedia.status, 'ready'))),
    ])

    const { journalSalt, journalCheck, ...settings } = profile?.settings ?? {}
    const data = {
      exportedAt: new Date().toISOString(),
      hinweis: 'Dein Tagebuch ist verschlüsselt. Entschlüsseln kannst nur du – mit deiner Tagebuch-PIN.',
      account: { ...user, displayName: profile?.displayName, defaultVisibility: profile?.defaultVisibility, settings },
      gedanken: myPosts,
      antworten: myReplies,
      zuspruchGesendet: given,
      merkliste: marks,
      kreise: prefs,
      checkins: myCheckins,
      atemuebungen: breaths,
      kleineSchritte: stepsDone,
      blockiert: blocked.length,
      tagebuch: { salt: journalSalt ?? null, pruefwert: journalCheck ?? null, eintraege: journal },
    }
    const files: Zippable = { 'lichtung.json': strToU8(JSON.stringify(data, null, 2)) }
    for (const m of media) {
      try {
        files[`bilder/${m.id}.webp`] = await getObjectBytes(m.key)
      } catch {}
    }
    const zip = zipSync(files, { level: 6 })
    const key = `exports/${exportId}.zip`
    await putObject(key, zip, 'application/zip')
    await db.update(exports).set({ status: 'ready', bucketKey: key, expiresAt: new Date(Date.now() + DAY) }).where(eq(exports.id, exportId))
  } catch (e) {
    console.error('[export]', (e as Error).message)
    await db.update(exports).set({ status: 'failed' }).where(eq(exports.id, exportId))
  }
}

/**
 * Endgültige Löschung (7 Tage nach dem Antrag oder nach 24 Monaten ohne Login).
 * Antworten auf Gedanken anderer bleiben als «Antwort gelöscht» stehen, damit Threads verständlich bleiben.
 * Der Benutzername bleibt 90 Tage reserviert.
 */
export async function purgeAccount({ userId, reason = 'deleted' }: { userId: string; reason?: 'deleted' | 'inactive' }) {
  const [u] = await db.select().from(users).where(eq(users.id, userId))
  if (!u) return
  if (reason === 'deleted' && (u.status !== 'deleting' || !u.deleteAfter || u.deleteAfter > new Date())) return

  if (bucketConfigured()) {
    const media = await db.select({ key: postMedia.bucketKey }).from(postMedia).where(eq(postMedia.userId, userId))
    for (const { key } of media) {
      await deleteObject(key).catch(() => {})
      if (key.endsWith('.webp')) await deleteObject(key.replace(/\.webp$/, '.avif')).catch(() => {})
    }
    const ex = await db.select({ key: exports.bucketKey }).from(exports).where(eq(exports.userId, userId))
    for (const { key } of ex) if (key) await deleteObject(key).catch(() => {})
  }
  await db.transaction(async (tx) => {
    await tx.update(replies).set({ body: '', deletedAt: new Date() }).where(eq(replies.userId, userId))
    await tx
      .insert(reservedUsernames)
      .values({ username: u.username, until: new Date(Date.now() + 90 * DAY) })
      .onConflictDoUpdate({ target: reservedUsernames.username, set: { until: new Date(Date.now() + 90 * DAY) } })
    await tx.delete(users).where(eq(users.id, userId))
  })
  console.log(`[purge] Konto gelöscht (${reason})`)
}

export async function purgeDueAccounts() {
  const due = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.status, 'deleting'), isNotNull(users.deleteAfter), lt(users.deleteAfter, new Date())))
  for (const { id } of due) await purgeAccount({ userId: id })
}

/**
 * Automatische Löschung nach 24 Monaten ohne Nutzung. «Letzter Login» allein reicht nicht:
 * Sitzungen gleiten, wer täglich eingeloggt bleibt, meldet sich nie neu an. Darum zählt auch
 * jede Sitzung, die in dieser Zeit benutzt wurde (sessions.last_seen_at).
 */
export async function purgeInactiveAccounts() {
  const cutoff = new Date(Date.now() - 730 * DAY)
  const stale = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        or(lt(users.lastLoginAt, cutoff), and(sql`${users.lastLoginAt} IS NULL`, lt(users.createdAt, cutoff)))!,
        inArray(users.role, ['member']),
        sql`NOT EXISTS (SELECT 1 FROM ${sessions} WHERE ${sessions.userId} = ${users.id} AND ${sessions.lastSeenAt} >= ${cutoff})`,
      ),
    )
  for (const { id } of stale) await purgeAccount({ userId: id, reason: 'inactive' })
}

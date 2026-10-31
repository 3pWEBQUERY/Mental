import { and, eq, inArray, sql } from 'drizzle-orm'
import { db } from '../db'
import { notifications, users } from '../db/schema'
import { m } from '../messages'
import { enqueue, QUEUES } from './jobs'
import { moderationAway, nightStaffed } from './moderation-hours'

/** Gleicher Kanal wie lib/server/notify.ts – weckt offene Glocken über alle Replikas. */
const NOTIFY_CHANNEL = 'lichtung_notify'

/**
 * Akuter Krisen-Treffer: Moderation und Admins sofort benachrichtigen – Glocke immer, Push während der
 * Moderationszeiten (mit Nachtbereitschaft rund um die Uhr, auch in den persönlichen Ruhezeiten).
 * Der Inhalt selbst steht nicht in der Nachricht (Sperrbildschirm), nur dass etwas wartet.
 * Läuft aus der App (beim Teilen/Antworten) und aus dem Worker (zweite Prüfung) – darum ohne «server-only».
 */
export async function alertAcute() {
  const staff = await db
    .select({ id: users.id })
    .from(users)
    .where(and(inArray(users.role, ['mod', 'admin']), eq(users.status, 'active')))
  if (!staff.length) return
  const message = m.admin.acuteAlert
  await db.insert(notifications).values(staff.map((s) => ({ userId: s.id, kind: 'system' as const, postId: null, payload: { message } })))
  const push = !moderationAway(nightStaffed())
  for (const s of staff) {
    await db.execute(sql`SELECT pg_notify(${NOTIFY_CHANNEL}, ${s.id})`)
    // Nachts ohne Bereitschaft kein Push: Um 7 Uhr erinnert der Monitor an alles, was noch wartet.
    if (!push) continue
    // Pro Person höchstens ein wartender Push – mehrere Treffer kurz hintereinander läuten nicht mehrfach.
    await enqueue(QUEUES.push, { userId: s.id, alert: true }, { singletonKey: `acute:${s.id}` })
  }
}

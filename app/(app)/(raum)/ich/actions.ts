'use server'

import { and, count, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { journalEntries, letters, profiles, safetyPlans, type SafetyPlan } from '@/db/schema'
import { getViewer } from '@/lib/server/session'
import { m } from '@/messages'

const b64 = z.string().regex(/^[A-Za-z0-9+/=]+$/)

export type JournalCipher = { id: string; ciphertext: string; iv: string; salt: string; createdAt: string }

export async function journalState(): Promise<{ salt: string; check: { iv: string; ciphertext: string; salt: string } } | null> {
  const v = await getViewer()
  if (!v?.settings.journalSalt || !v.settings.journalCheck) return null
  return { salt: v.settings.journalSalt, check: v.settings.journalCheck }
}

/** Speichert nur das Salz und einen verschlüsselten Prüfwert – nie die PIN. */
export async function setupJournal(input: { salt: string; check: { iv: string; ciphertext: string; salt: string } }) {
  const v = await getViewer()
  if (!v) return false
  const parsed = z.object({ salt: b64, check: z.object({ iv: b64, ciphertext: b64, salt: b64 }) }).safeParse(input)
  if (!parsed.success || v.settings.journalSalt) return false
  await db
    .update(profiles)
    .set({ settings: { ...v.settings, journalSalt: parsed.data.salt, journalCheck: parsed.data.check } })
    .where(eq(profiles.userId, v.userId))
  return true
}

export async function listJournal(): Promise<JournalCipher[]> {
  const v = await getViewer()
  if (!v) return []
  const rows = await db
    .select()
    .from(journalEntries)
    .where(eq(journalEntries.userId, v.userId))
    .orderBy(desc(journalEntries.createdAt))
    .limit(500)
  return rows.map((r) => ({ id: r.id, ciphertext: r.ciphertext, iv: r.iv, salt: r.salt, createdAt: r.createdAt.toISOString() }))
}

export async function addJournalEntry(input: { ciphertext: string; iv: string; salt: string }): Promise<JournalCipher | null> {
  const v = await getViewer()
  if (!v) return null
  // 5000 Zeichen Klartext ergeben höchstens ~27 kB Base64.
  const parsed = z.object({ ciphertext: b64.max(30_000), iv: b64.max(32), salt: b64.max(32) }).safeParse(input)
  if (!parsed.success) return null
  const [r] = await db
    .insert(journalEntries)
    .values({ userId: v.userId, ...parsed.data })
    .returning()
  return { id: r!.id, ciphertext: r!.ciphertext, iv: r!.iv, salt: r!.salt, createdAt: r!.createdAt.toISOString() }
}

export async function deleteJournalEntry(id: string) {
  const v = await getViewer()
  if (!v || !z.uuid().safeParse(id).success) return false
  await db.delete(journalEntries).where(and(eq(journalEntries.id, id), eq(journalEntries.userId, v.userId)))
  return true
}

/* ------------------------------------------------------- Mein Notfallplan */

const PLAN_KEYS = ['signs', 'self', 'distract', 'people', 'pros', 'safe'] as const
const planSchema = z.object(Object.fromEntries(PLAN_KEYS.map((k) => [k, z.string().trim().max(1500)])) as Record<(typeof PLAN_KEYS)[number], z.ZodString>)

export async function getSafetyPlan(): Promise<SafetyPlan | null> {
  const v = await getViewer()
  if (!v) return null
  const [row] = await db.select({ plan: safetyPlans.plan }).from(safetyPlans).where(eq(safetyPlans.userId, v.userId))
  return row?.plan ?? null
}

export async function saveSafetyPlan(input: SafetyPlan): Promise<{ ok: true } | { ok: false; error: string }> {
  const v = await getViewer()
  if (!v) return { ok: false, error: m.common.sessionEnded }
  const parsed = planSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: m.common.error }
  const plan = parsed.data
  // Ganz leer = kein Plan; so verschwindet er auch wieder aus dem Hilfe-Dialog.
  if (PLAN_KEYS.every((k) => !plan[k])) {
    await db.delete(safetyPlans).where(eq(safetyPlans.userId, v.userId))
    return { ok: true }
  }
  await db
    .insert(safetyPlans)
    .values({ userId: v.userId, plan })
    .onConflictDoUpdate({ target: safetyPlans.userId, set: { plan, updatedAt: new Date() } })
  return { ok: true }
}

/* ------------------------------------------------ Brief an mein späteres Ich */

export type LetterView = { id: string; body: string; createdAt: string; shownAt: string | null }

export async function myLetters(): Promise<LetterView[]> {
  const v = await getViewer()
  if (!v) return []
  const rows = await db.select().from(letters).where(eq(letters.userId, v.userId)).orderBy(desc(letters.createdAt)).limit(50)
  return rows.map((l) => ({ id: l.id, body: l.body, createdAt: l.createdAt.toISOString(), shownAt: l.shownAt?.toISOString() ?? null }))
}

export async function writeLetter(body: string): Promise<{ ok: true; letter: LetterView } | { ok: false; error: string }> {
  const v = await getViewer()
  if (!v) return { ok: false, error: m.common.sessionEnded }
  const text = z.string().trim().min(1).max(2000).safeParse(body)
  if (!text.success) return { ok: false, error: m.common.error }
  const [{ n } = { n: 0 }] = await db.select({ n: count() }).from(letters).where(eq(letters.userId, v.userId))
  if (n >= 50) return { ok: false, error: m.letters.tooMany }
  const [l] = await db.insert(letters).values({ userId: v.userId, body: text.data }).returning()
  return { ok: true, letter: { id: l!.id, body: l!.body, createdAt: l!.createdAt.toISOString(), shownAt: null } }
}

export async function deleteLetter(id: string): Promise<boolean> {
  const v = await getViewer()
  if (!v || !z.uuid().safeParse(id).success) return false
  const done = await db.delete(letters).where(and(eq(letters.id, id), eq(letters.userId, v.userId))).returning({ id: letters.id })
  return done.length > 0
}

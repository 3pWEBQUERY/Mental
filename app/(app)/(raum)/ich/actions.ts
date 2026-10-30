'use server'

import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { journalEntries, profiles } from '@/db/schema'
import { getViewer } from '@/lib/server/session'

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

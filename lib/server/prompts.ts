import 'server-only'
import { and, asc, eq, inArray, notInArray } from 'drizzle-orm'
import { db } from '@/db'
import { circlePrefs, circles, prompts } from '@/db/schema'
import { localCircleName, localPromptText } from '@/lib/localize'
import { zurichDay } from '@/lib/time'

export type TeamPrompt = { id: string; text: string; circle: { slug: string; name: string; color: string } }

const columns = {
  id: prompts.id,
  text: prompts.text,
  i18n: prompts.i18n,
  slug: circles.slug,
  name: circles.name,
  circleI18n: circles.i18n,
  color: circles.color,
}

type Row = { id: string; text: string; i18n: typeof prompts.$inferSelect.i18n; slug: string; name: string; circleI18n: typeof circles.$inferSelect.i18n; color: string }
const toPrompt = (r: Row): TeamPrompt => ({
  id: r.id,
  text: localPromptText(r.text, r.i18n),
  circle: { slug: r.slug, name: localCircleName(r.name, r.circleI18n), color: r.color },
})

/** Aktive Fragen eines Kreises (in der Sprache der Person). */
export async function getCirclePrompts(circleId: string): Promise<TeamPrompt[]> {
  const rows = await db
    .select(columns)
    .from(prompts)
    .innerJoin(circles, eq(circles.id, prompts.circleId))
    .where(and(eq(prompts.circleId, circleId), eq(prompts.isActive, true), eq(circles.isActive, true)))
    .orderBy(asc(prompts.sort), asc(prompts.createdAt))
  return rows.map(toPrompt)
}

/**
 * Eine Frage für «Alle»: wechselt jeden Tag, aus allen aktiven Kreisen ausser stummgeschalteten (oder nur aus den
 * gefolgten bei «Meine Kreise»). Alle sehen am selben Tag dieselbe Frage – sie gilt für den ganzen Raum.
 */
export async function getPromptOfDay(viewerId: string, followedOnly = false): Promise<TeamPrompt | null> {
  const prefs = (state: 'follow' | 'mute') =>
    db
      .select({ id: circlePrefs.circleId })
      .from(circlePrefs)
      .where(and(eq(circlePrefs.userId, viewerId), eq(circlePrefs.state, state)))
  const rows = await db
    .select(columns)
    .from(prompts)
    .innerJoin(circles, eq(circles.id, prompts.circleId))
    .where(
      and(
        eq(prompts.isActive, true),
        eq(circles.isActive, true),
        followedOnly ? inArray(prompts.circleId, prefs('follow')) : notInArray(prompts.circleId, prefs('mute')),
      ),
    )
    .orderBy(asc(prompts.sort), asc(prompts.id))
  if (!rows.length) return null
  const day = zurichDay()
  // Tag als Zahl (z. B. 2026-11-12 → 20261112): einfache, stabile Rotation.
  const n = Number(String(day).replace(/\D/g, '')) || 0
  return toPrompt(rows[n % rows.length]!)
}

/** Prüft beim Teilen, ob die Frage aktiv ist und zum gewählten Kreis gehört – sonst wird sie nicht verknüpft. */
export async function promptForCircle(promptId: string, circleId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: prompts.id })
    .from(prompts)
    .where(and(eq(prompts.id, promptId), eq(prompts.circleId, circleId), eq(prompts.isActive, true)))
    .limit(1)
  return row?.id ?? null
}

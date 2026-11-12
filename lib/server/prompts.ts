import 'server-only'
import { and, asc, eq, inArray, notInArray } from 'drizzle-orm'
import { db } from '@/db'
import { circlePrefs, circles, prompts } from '@/db/schema'
import { localCircleName, localPromptText } from '@/lib/localize'
import { randomInt } from 'node:crypto'

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

/** Cookie mit der zuletzt in «Alle» gezeigten Frage – damit beim nächsten Laden eine andere kommt. */
export const LAST_PROMPT_COOKIE = 'jiaia_tp'

/**
 * Eine Frage für «Alle»: bei jedem Laden zufällig eine andere – nie dieselbe wie beim letzten Mal (`lastId`).
 * Aus allen aktiven Kreisen ausser stummgeschalteten (oder nur aus den gefolgten bei «Meine Kreise»).
 */
export async function getFeedPrompt(viewerId: string, followedOnly = false, lastId?: string | null): Promise<TeamPrompt | null> {
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
  if (!rows.length) return null
  const pool = rows.length > 1 ? rows.filter((r) => r.id !== lastId) : rows
  return toPrompt(pool[randomInt(pool.length)]!)
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

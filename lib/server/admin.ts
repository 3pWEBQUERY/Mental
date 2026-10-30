import 'server-only'
import { redirect } from 'next/navigation'
import { env } from './env'
import { getViewer, type Viewer } from './session'

export type ModLevel = 'peer' | 'mod' | 'admin'
const RANK = { member: 0, peer_mod: 1, mod: 2, admin: 3 } as const
const NEED = { peer: 1, mod: 2, admin: 3 } as const

export function canModerate(v: Viewer, level: ModLevel) {
  return RANK[v.role] >= NEED[level]
}

/** Admin-Bereich nur mit eigener Rolle und nur in einer Sitzung, die per Passkey begonnen hat. */
export function hasStrongAuth(v: Viewer) {
  return v.authMethod === 'passkey' || env.adminWithoutPasskey
}

/** Nur die Rolle – für das Admin-Layout und den Hinweis «Passkey nötig». */
export async function requireModeratorRole(level: ModLevel = 'peer'): Promise<Viewer> {
  const v = await getViewer()
  if (!v) redirect('/anmelden')
  if (!canModerate(v, level)) redirect('/lichtung')
  return v
}

/**
 * Jede Admin-Seite prüft Rolle UND Passkey-Sitzung selbst. Das Layout allein schützt nicht:
 * Seiten laufen parallel zum Layout und landen sonst trotzdem im RSC-Payload.
 */
export async function requireModerator(level: ModLevel = 'peer'): Promise<Viewer> {
  const v = await requireModeratorRole(level)
  if (!hasStrongAuth(v)) redirect('/admin/passkey')
  return v
}

/** Für Server Actions: wirft statt umzuleiten. */
export async function assertModerator(level: ModLevel): Promise<Viewer> {
  const v = await getViewer()
  if (!v || !canModerate(v, level) || !hasStrongAuth(v)) throw new Error('forbidden')
  return v
}

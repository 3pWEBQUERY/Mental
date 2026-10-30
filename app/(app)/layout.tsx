import { and, desc, eq } from 'drizzle-orm'
import { connection } from 'next/server'
import type { ReactNode } from 'react'
import { AppChrome } from '@/components/app/chrome'
import { ViewerProvider, type ClientViewer } from '@/components/viewer'
import { db } from '@/db'
import { checkins, circlePrefs, circles as circlesTable } from '@/db/schema'
import { requireViewer } from '@/lib/server/session'
import { getCircles, getCrisisTerms, getHelpResources } from '@/lib/server/terms'
import { presenceCounts, unreadState } from './actions'

// Alles hinter der Anmeldung wird pro Request gerendert: eigene CSP-Nonce, keine geteilten Shells.
export const instant = false

export default async function AppLayout({ children }: { children: ReactNode }) {
  await connection()
  const v = await requireViewer()
  const [last, circles, crisisTerms, help, unread, presence, follows] = await Promise.all([
    db.select({ mood: checkins.mood }).from(checkins).where(eq(checkins.userId, v.userId)).orderBy(desc(checkins.createdAt)).limit(1),
    getCircles(),
    getCrisisTerms(),
    getHelpResources(),
    unreadState(),
    presenceCounts(),
    db
      .select({ slug: circlesTable.slug })
      .from(circlePrefs)
      .innerJoin(circlesTable, eq(circlesTable.id, circlePrefs.circleId))
      .where(and(eq(circlePrefs.userId, v.userId), eq(circlePrefs.state, 'follow'))),
  ])
  const s = v.settings
  const value: ClientViewer = {
    displayName: v.displayName,
    glyphSeed: v.glyphSeed,
    defaultVisibility: v.defaultVisibility,
    role: v.role,
    muted: v.status === 'muted',
    lastMood: last[0]?.mood ?? null,
    motion: s.motion ?? 'on',
    theme: s.theme ?? 'light',
    fontSize: s.fontSize ?? 'normal',
    discreet: s.discreet ?? false,
    breathSound: s.breathSound ?? false,
    collapseWarnings: s.collapseWarnings ?? true,
    hidePresence: s.hidePresence ?? false,
    circles,
    following: follows.map((f) => f.slug),
    crisisTerms,
    help,
  }
  return (
    <ViewerProvider value={value}>
      <AppChrome initialUnread={unread.unread} pulseOnOpen={unread.supportSinceLastVisit} presence={presence}>
        {children}
      </AppChrome>
    </ViewerProvider>
  )
}


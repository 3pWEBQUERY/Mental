import type { Metadata } from 'next'
import { asc, eq } from 'drizzle-orm'
import { Suspense } from 'react'
import { Loading } from '@/components/ui'
import { SettingsView } from '@/components/settings/settings-view'
import { db } from '@/db'
import { circlePrefs, circles, pushSubscriptions } from '@/db/schema'
import { requireViewer } from '@/lib/server/session'
import { m } from '@/messages'
import { listBlocked, listSessions } from './actions'

export const metadata: Metadata = { title: m.settings.title }

export default function SettingsPage() {
  return (
    <main className="page" id="inhalt">
      <div className="page-head">
        <h1 className="page-title">{m.settings.title}</h1>
      </div>
      <Suspense fallback={<Loading />}>
        <Data />
      </Suspense>
    </main>
  )
}

async function Data() {
  const v = await requireViewer()
  const [circleRows, prefs, sessions, blocked, [sub]] = await Promise.all([
    db.select().from(circles).where(eq(circles.isActive, true)).orderBy(asc(circles.sort)),
    db.select().from(circlePrefs).where(eq(circlePrefs.userId, v.userId)),
    listSessions(),
    listBlocked(),
    db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, v.userId)).limit(1),
  ])
  return (
    <SettingsView
      data={{
        displayName: v.displayName,
        defaultVisibility: v.defaultVisibility,
        settings: { theme: v.settings.theme, fontSize: v.settings.fontSize, motion: v.settings.motion, breathSound: v.settings.breathSound, hidePresence: v.settings.hidePresence, collapseWarnings: v.settings.collapseWarnings },
        circles: circleRows.map((c) => ({ slug: c.slug, name: c.name, color: c.color, state: prefs.find((p) => p.circleId === c.id)?.state ?? null })),
        sessions,
        blocked,
        quiet: { from: sub?.quietFrom ?? 22, to: sub?.quietTo ?? 7 },
        vapidKey: process.env.VAPID_PUBLIC_KEY ?? null,
      }}
    />
  )
}

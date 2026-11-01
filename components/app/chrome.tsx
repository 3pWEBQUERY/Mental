'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import { getSafetyPlan } from '@/app/(app)/(raum)/ich/actions'
import { listNotifications, markNotificationsRead, type ClientNotification } from '@/app/(app)/actions'
import type { SafetyPlan } from '@/db/schema'
import { emit, on, pulse } from '@/lib/client/bus'
import { applyLocalPrefs, PREFS_KEY } from '@/lib/prefs-script'
import { relativeTime } from '@/lib/time'
import { m } from '@/messages'
import { ConfirmHost } from '../confirm'
import { Dialog } from '../dialog'
import { HelpList, PhoneScript } from '../ui'
import { useViewer } from '../viewer'
import { CirclesList } from './circles'
import { Grounding } from '../raum/grounding'
import { SafetyPlanView } from '../me/for-me'
import { Composer } from './composer'
import { Rail } from './rail'
import { ServiceWorkerRegister } from './sw-register'
import { attempt } from '@/lib/client/attempt'
import { AppealInline } from './appeal'
import { Onboarding } from './onboarding'
import { MobileNav } from './mobile-nav'
import { useModerationAway } from './use-moderation-away'

/**
 * Alles, was auf jedem App-Screen da ist: Navigation, Hilfe, Benachrichtigungen, Composer.
 * Die Glocke hört per Server-Sent Events auf neue Benachrichtigungen, solange die App offen ist.
 */
export function AppChrome({
  children,
  initialUnread,
  pulseOnOpen,
  presence,
}: {
  children: ReactNode
  initialUnread: number
  pulseOnOpen: boolean
  presence: Record<string, number | null>
}) {
  const viewer = useViewer()
  const away = useModerationAway()
  const router = useRouter()
  const [unread, setUnread] = useState(initialUnread)
  const [helpOpen, setHelpOpen] = useState(false)
  const [circlesOpen, setCirclesOpen] = useState(false)
  const [planOpen, setPlanOpen] = useState(false)
  const [plan, setPlan] = useState<SafetyPlan | null>(null)
  const [notifOpen, setNotifOpen] = useState(false)
  const [items, setItems] = useState<ClientNotification[] | null>(null)

  // Neues Gerät: Noch nichts lokal gewählt → die im Konto gespeicherte Darstellung übernehmen.
  useEffect(() => {
    try {
      if (localStorage.getItem(PREFS_KEY) === null) applyLocalPrefs({ theme: viewer.theme, fontSize: viewer.fontSize, motion: viewer.motion, discreet: viewer.discreet })
    } catch {}
  }, [viewer.theme, viewer.fontSize, viewer.motion, viewer.discreet])
  useEffect(() => on('help', () => setHelpOpen(true)), [])
  useEffect(
    () =>
      on('notifications', async () => {
        setNotifOpen(true)
        // Laden schlägt fehl: leere Liste statt endlos «Einen Moment …».
        setItems((await attempt(() => listNotifications())) ?? [])
        await markNotificationsRead().catch(() => {})
        setUnread(0)
      }),
    [],
  )
  // Zuspruch, der während der Abwesenheit kam, lässt die Kugel beim Öffnen pulsieren.
  useEffect(() => {
    if (!pulseOnOpen) return
    const t = setTimeout(pulse, 900)
    return () => clearTimeout(t)
  }, [pulseOnOpen])

  useEffect(() => {
    const es = new EventSource('/api/events')
    es.addEventListener('notification', (e) => {
      const data = JSON.parse((e as MessageEvent<string>).data) as { unread: number; support: boolean }
      setUnread(data.unread)
      if (data.support) pulse()
    })
    return () => es.close()
  }, [])

  return (
    <>
      <a className="skip" href="#inhalt">
        {m.nav.skip}
      </a>
      <div className="app">
        <Rail
          unread={unread}
          onCircles={() => {
            const side = document.querySelector<HTMLElement>('.side .circle')
            if (side && getComputedStyle(side.closest('.side')!).display !== 'none') side.focus()
            else setCirclesOpen(true)
          }}
        />
        {children}
      </div>
      <MobileNav unread={unread} circlesOpen={circlesOpen} onCircles={() => setCirclesOpen(true)} />

      <Composer />
      <Grounding />
      <Onboarding />

      <Dialog open={helpOpen} onClose={() => setHelpOpen(false)} title={m.help.title}>
        {away && <p className="notice night-note">{m.night.help}</p>}
        <div className="help">
          <HelpList resources={viewer.help} eyebrow={false} />
        </div>
        <div className="row-actions" style={{ marginTop: 14, gap: 18, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn ghost small"
            onClick={async () => {
              setPlan((await attempt(() => getSafetyPlan())) ?? null)
              setPlanOpen(true)
            }}
          >
            {m.plan.open}
          </button>
          <button
            type="button"
            className="linkish"
            onClick={() => {
              setHelpOpen(false)
              emit('grounding')
            }}
          >
            {m.grounding.open}
          </button>
        </div>
        <PhoneScript />
        <p className="fine" style={{ marginTop: 14 }}>
          {m.help.honest}
        </p>
      </Dialog>

      <Dialog open={planOpen} onClose={() => setPlanOpen(false)} title={m.plan.title}>
        {plan ? (
          <SafetyPlanView plan={plan} />
        ) : (
          <p className="notice">{m.plan.empty}</p>
        )}
        <p style={{ marginTop: 18 }}>
          <Link className="btn ghost small" href="/ich?tab=fuermich" onClick={() => (setPlanOpen(false), setHelpOpen(false))}>
            {plan ? m.plan.edit : m.plan.create}
          </Link>
        </p>
      </Dialog>

      <Dialog open={circlesOpen} onClose={() => setCirclesOpen(false)} title={m.circles.title}>
        <CirclesList presence={presence} onPick={() => setCirclesOpen(false)} />
      </Dialog>

      <Dialog open={notifOpen} onClose={() => setNotifOpen(false)} title={m.notifications.title}>
        {items === null ? (
          <p className="fine">{m.common.loading}</p>
        ) : items.length === 0 ? (
          <p className="notice">{m.notifications.empty}</p>
        ) : (
          <ul>
            {items.map((n) => (
              <li key={n.id} className={`notif${n.read ? '' : ' unread'}`}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="notif-title">
                    {!n.read && <span className="sr-only">{m.notifications.unread}: </span>}
                    {n.kind === 'reply'
                      ? m.notifications.reply
                      : n.kind === 'support'
                        ? m.notifications.support(n.count)
                        : n.kind === 'system'
                          ? m.notifications.system
                          : m.notifications.moderation}
                  </div>
                  {(n.kind === 'moderation' || n.kind === 'system') && n.message ? (
                    <>
                      <p>{n.message}</p>
                      {n.appealable && <AppealInline />}
                    </>
                  ) : n.postDeleted ? (
                    <p>{m.feed.deletedPost}</p>
                  ) : (
                    n.excerpt && <p>«{n.excerpt}»</p>
                  )}
                  <small suppressHydrationWarning>{relativeTime(n.createdAt)}</small>
                </div>
                {n.postId && (
                  <Link
                    className="btn ghost small"
                    href={`/start/gedanke/${n.postId}`}
                    onClick={() => setNotifOpen(false)}
                  >
                    {m.notifications.open}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </Dialog>
      <ConfirmHost />
      <ServiceWorkerRegister />
      <ComposeOnQuery router={router} />
    </>
  )
}

/** /start?atmen=1 startet die Atemübung, ?teilen=1 öffnet den Composer (z. B. aus der PWA). */
function ComposeOnQuery({ router }: { router: ReturnType<typeof useRouter> }) {
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    if (q.has('atmen')) setTimeout(() => emit('breathe'), 400)
    if (q.has('teilen')) emit('compose')
    if (q.has('atmen') || q.has('teilen')) router.replace(window.location.pathname)
  }, [router])
  return null
}

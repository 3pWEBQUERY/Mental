'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import { listNotifications, markNotificationsRead, type ClientNotification } from '@/app/(app)/actions'
import { emit, on, pulse } from '@/lib/client/bus'
import { relativeTime } from '@/lib/time'
import { m } from '@/messages'
import { ConfirmHost } from '../confirm'
import { Dialog } from '../dialog'
import { HelpList } from '../ui'
import { useViewer } from '../viewer'
import { CirclesList } from './circles'
import { Composer } from './composer'
import { Rail } from './rail'
import { ServiceWorkerRegister } from './sw-register'

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
  const router = useRouter()
  const [unread, setUnread] = useState(initialUnread)
  const [helpOpen, setHelpOpen] = useState(false)
  const [circlesOpen, setCirclesOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [items, setItems] = useState<ClientNotification[] | null>(null)

  useEffect(() => on('help', () => setHelpOpen(true)), [])
  useEffect(
    () =>
      on('notifications', async () => {
        setNotifOpen(true)
        setItems(await listNotifications())
        await markNotificationsRead()
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
        Zum Inhalt
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

      <Composer />

      <Dialog open={helpOpen} onClose={() => setHelpOpen(false)} title={m.help.title}>
        <div className="help">
          <HelpList resources={viewer.help} />
        </div>
        <p className="fine" style={{ marginTop: 14 }}>
          {m.help.honest}
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
                    {n.kind === 'reply'
                      ? m.notifications.reply
                      : n.kind === 'support'
                        ? m.notifications.support(n.count)
                        : m.notifications.moderation}
                  </div>
                  {n.kind === 'moderation' && n.message ? (
                    <p>{n.message}</p>
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
                    href={`/lichtung/gedanke/${n.postId}`}
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

/** /lichtung?atmen=1 startet die Atemübung, ?teilen=1 öffnet den Composer (z. B. aus der PWA). */
function ComposeOnQuery({ router }: { router: ReturnType<typeof useRouter> }) {
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    if (q.has('atmen')) setTimeout(() => emit('breathe'), 400)
    if (q.has('teilen')) emit('compose')
    if (q.has('atmen') || q.has('teilen')) router.replace(window.location.pathname)
  }, [router])
  return null
}

'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { emit } from '@/lib/client/bus'
import { m } from '@/messages'
import { panic } from '../panic'
import { useBlob } from '../use-blob'
import { Icon } from './icons'

type Tab = 'feed' | 'circles' | 'me' | 'settings'

function tabOf(path: string): Tab | null {
  if (path.startsWith('/start')) return 'feed'
  if (path.startsWith('/ich')) return 'me'
  if (path.startsWith('/einstellungen')) return 'settings'
  return null
}

/**
 * Navigation auf dem Handy: zwei schwebende Glas-Leisten unten (Aktionen und Reiter) und oben rechts Glocke und
 * «Schnell ausblenden» – der Notausgang bleibt so jederzeit mit einem Tipp erreichbar, auch beim Atmen.
 * Der aktive Reiter ist der Three.js-Tropfen (wie bei allen Reitern): Er fliesst beim Wechsel zum neuen Reiter,
 * auch zu «Kreise», solange die Kreisliste offen ist. Auf dem Desktop bleibt die Leiste links (rail.tsx).
 */
export function MobileNav({ unread, circlesOpen, onCircles }: { unread: number; circlesOpen: boolean; onCircles: () => void }) {
  const path = usePathname()
  const router = useRouter()
  const n = m.nav
  const routeTab = tabOf(path)
  const [tapped, setTapped] = useState<Tab | null>(null)
  // Die Route bestätigt den Reiter (auch Zurück/Vor) – bis dahin gilt der angetippte.
  useEffect(() => setTapped(null), [path])
  const active = circlesOpen ? 'circles' : (tapped ?? routeTab)
  const { host, on, layers } = useBlob<HTMLElement>(active, { colorVar: '--nav-active' })
  const inRoom = path.startsWith('/start') || path.startsWith('/ich')

  const tabs: { key: Tab; label: string; icon: React.ReactNode; href?: string }[] = [
    { key: 'feed', label: n.feed, icon: Icon.sunrise, href: '/start' },
    { key: 'circles', label: n.circles, icon: Icon.ring },
    { key: 'me', label: n.me, icon: Icon.leaf, href: '/ich' },
    { key: 'settings', label: n.settings, icon: Icon.gear, href: '/einstellungen' },
  ]

  return (
    <>
      <div className="mnav-top">
        <button
          type="button"
          className="mnav-round"
          aria-label={unread ? `${n.notifications} (${unread} neu)` : n.notifications}
          onClick={() => emit('notifications')}
        >
          {Icon.bell}
          {unread > 0 && <i className="badge" aria-hidden="true" />}
        </button>
        <button type="button" className="mnav-round" aria-label={n.panic} onClick={panic}>
          {Icon.hide}
        </button>
      </div>
      <div className="mnav-bottom">
        <div className="mnav-actions">
          <button type="button" className="mnav-help" onClick={() => emit('help')}>
            {Icon.help}
            <span>{n.help}</span>
          </button>
          <button type="button" aria-label={n.breathe} onClick={() => (inRoom ? emit('breathe') : router.push('/start?atmen=1'))}>
            {Icon.wind}
            <span aria-hidden="true">{n.breatheShort}</span>
          </button>
          <button type="button" aria-label={n.share} onClick={() => emit('compose')}>
            {Icon.share}
            <span aria-hidden="true">{n.shareShort}</span>
          </button>
        </div>
        <nav ref={host} className={`mnav-tabs${on ? ' blob-on' : ''}`} aria-label={n.label}>
          {layers(
            tabs.map((t) => (
              <span key={t.key} className="mnav-tab blob-copy">
                {t.icon}
                <span>{t.label}</span>
              </span>
            )),
          )}
          {tabs.map((t) =>
            t.href ? (
              <Link
                key={t.key}
                href={t.href}
                data-blob={t.key}
                className="mnav-tab"
                aria-current={active === t.key ? 'page' : undefined}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
                  setTapped(t.key)
                }}
              >
                {t.icon}
                <span>{t.label}</span>
              </Link>
            ) : (
              <button
                key={t.key}
                type="button"
                data-blob={t.key}
                className="mnav-tab"
                aria-current={active === t.key ? 'true' : undefined}
                aria-haspopup="dialog"
                onClick={onCircles}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            ),
          )}
        </nav>
      </div>
    </>
  )
}

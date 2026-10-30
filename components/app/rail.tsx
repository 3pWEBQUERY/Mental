'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { emit } from '@/lib/client/bus'
import { m } from '@/messages'
import { panic } from '../panic'
import { Mark } from '../ui'
import { useViewer } from '../viewer'
import { Icon } from './icons'

export function Rail({ unread, onCircles }: { unread: number; onCircles: () => void }) {
  const path = usePathname()
  const router = useRouter()
  const viewer = useViewer()
  const n = m.nav
  const here = (p: string) => (path === p || path.startsWith(`${p}/`) ? 'page' : undefined)
  const inRoom = path.startsWith('/lichtung') || path.startsWith('/ich')

  return (
    <nav className="rail" aria-label={n.label}>
      <Link href="/lichtung" aria-label={n.feed} className="home desktop-only">
        <Mark />
      </Link>
      <Link href="/lichtung" data-label={n.feed} aria-label={n.feed} aria-current={here('/lichtung')}>
        {Icon.feed}
      </Link>
      <button type="button" data-label={n.share} aria-label={n.share} onClick={() => emit('compose')}>
        {Icon.share}
      </button>
      <button
        type="button"
        data-label={n.breathe}
        aria-label={n.breathe}
        onClick={() => (inRoom ? emit('breathe') : router.push('/lichtung?atmen=1'))}
      >
        {Icon.breathe}
      </button>
      <button type="button" className="circles-btn" data-label={n.circles} aria-label={n.circles} onClick={onCircles}>
        {Icon.circles}
      </button>
      <Link href="/ich" data-label={n.me} aria-label={n.me} aria-current={here('/ich')}>
        {Icon.me}
      </Link>
      <button
        type="button"
        data-label={n.notifications}
        aria-label={unread ? `${n.notifications} (${unread} neu)` : n.notifications}
        onClick={() => emit('notifications')}
      >
        {Icon.bell}
        {unread > 0 && <i className="badge" aria-hidden="true" />}
      </button>
      <div className="spacer" />
      {(viewer.role === 'mod' || viewer.role === 'admin' || viewer.role === 'peer_mod') && (
        <Link href="/admin" className="desktop-only" data-label={n.admin} aria-label={n.admin} aria-current={here('/admin')}>
          {Icon.shield}
        </Link>
      )}
      <Link href="/einstellungen" className="desktop-only" data-label={n.settings} aria-label={n.settings} aria-current={here('/einstellungen')}>
        {Icon.settings}
      </Link>
      <button type="button" className="desktop-only" data-label={n.panic} aria-label={n.panic} onClick={panic}>
        {Icon.hide}
      </button>
      <button type="button" className="help-btn" data-label={n.help} aria-label={n.help} onClick={() => emit('help')}>
        {Icon.help}
      </button>
    </nav>
  )
}

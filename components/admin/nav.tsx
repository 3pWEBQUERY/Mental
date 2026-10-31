'use client'

import { usePathname } from 'next/navigation'
import { TabBar } from '@/components/tab-bar'
import { m } from '@/messages'

type Level = 'peer' | 'mod' | 'admin'
const ITEMS: { href: string; label: string; level: Level }[] = [
  { href: '/admin', label: m.admin.nav.queue, level: 'peer' },
  { href: '/admin/bilder', label: m.admin.nav.images, level: 'mod' },
  { href: '/admin/kreise', label: m.admin.nav.circles, level: 'admin' },
  { href: '/admin/hilfe', label: m.admin.nav.help, level: 'admin' },
  { href: '/admin/begriffe', label: m.admin.nav.terms, level: 'admin' },
  { href: '/admin/schritte', label: m.admin.nav.steps, level: 'admin' },
  { href: '/admin/audit', label: m.admin.nav.audit, level: 'mod' },
]
const RANK = { peer: 1, mod: 2, admin: 3 } as const

export function AdminNav({ level, imagesWaiting }: { level: Level; imagesWaiting: number }) {
  const path = usePathname()
  return (
    <TabBar
      label={m.admin.title}
      active={path}
      keepScroll={false}
      style={{ width: 'fit-content', maxWidth: '100%', flexWrap: 'wrap', marginBottom: 28 }}
      items={ITEMS.filter((i) => RANK[level] >= RANK[i.level]).map((i) => ({
        key: i.href,
        href: i.href,
        label: (
          <>
            {i.label}
            {i.href === '/admin/bilder' && imagesWaiting > 0 && (
              <span className="tab-count" aria-label={m.admin.images.waiting(imagesWaiting)}>
                {imagesWaiting}
              </span>
            )}
          </>
        ),
      }))}
    />
  )
}

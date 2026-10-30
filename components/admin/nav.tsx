'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { m } from '@/messages'

const ITEMS = [
  { href: '/admin', label: m.admin.nav.queue, admin: false },
  { href: '/admin/kreise', label: m.admin.nav.circles, admin: true },
  { href: '/admin/hilfe', label: m.admin.nav.help, admin: true },
  { href: '/admin/begriffe', label: m.admin.nav.terms, admin: true },
  { href: '/admin/schritte', label: m.admin.nav.steps, admin: true },
  { href: '/admin/audit', label: m.admin.nav.audit, admin: false },
]

export function AdminNav({ admin }: { admin: boolean }) {
  const path = usePathname()
  return (
    <nav className="tabs" aria-label={m.admin.title} style={{ width: 'fit-content', marginBottom: 28 }}>
      {ITEMS.filter((i) => admin || !i.admin).map((i) => (
        <Link key={i.href} href={i.href} className="tab" aria-current={path === i.href ? 'page' : undefined}>
          {i.label}
        </Link>
      ))}
    </nav>
  )
}

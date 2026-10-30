import { connection } from 'next/server'
import type { ReactNode } from 'react'
import { Stage } from '@/components/raum/stage'
import { formatDate, zurichHour } from '@/lib/time'
import { m } from '@/messages'

export const instant = false

/** Der Raum bleibt beim Wechsel zwischen Lichtung und «Ich» stehen – die Kugel wird nicht neu aufgebaut. */
export default async function RoomLayout({ children }: { children: ReactNode }) {
  await connection()
  const now = new Date()
  const h = zurichHour(now)
  const g = m.stage.greeting
  return (
    <>
      <Stage
        dateLabel={formatDate(now, { weekday: 'long', day: 'numeric', month: 'long' })}
        greeting={h < 11 ? g.morning : h < 18 ? g.day : g.evening}
      />
      {children}
    </>
  )
}

import { connection } from 'next/server'
import type { ReactNode } from 'react'

// Pro Request gerendert, damit jede Seite eine eigene CSP-Nonce trägt (vorgerendertes HTML kann keine haben).
export const instant = false

export default async function AuthLayout({ children }: { children: ReactNode }) {
  await connection()
  return children
}

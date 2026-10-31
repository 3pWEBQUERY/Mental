'use client'

import { createContext, use, type ReactNode } from 'react'
import type { CrisisTerm } from '@/lib/crisis'
import type { HelpResource } from '@/lib/help'

export type ClientCircle = { id: string; slug: string; name: string; color: string; description: string; rules: string }

/** Was der Browser über die angemeldete Person wissen darf – bewusst schmal, ohne Konto-ID. */
export type ClientViewer = {
  displayName: string
  glyphSeed: number
  defaultVisibility: 'anonymous' | 'pseudonym'
  role: 'member' | 'peer_mod' | 'mod' | 'admin'
  muted: boolean
  lastMood: number | null
  motion: 'on' | 'reduced' | 'off'
  /** Gespeicherte Darstellung – gilt auf einem neuen Gerät, bis dort lokal etwas gewählt wird. */
  theme: 'system' | 'light' | 'dark'
  fontSize: 'normal' | 'large' | 'xlarge'
  discreet: boolean
  /** Neues Konto: Einführung zeigen. */
  onboard: boolean
  listener: boolean
  breathSound: boolean
  collapseWarnings: boolean
  hidePresence: boolean
  circles: ClientCircle[]
  /** Slugs der Kreise, denen die Person folgt – für den Filter «Meine Kreise». */
  following: string[]
  crisisTerms: CrisisTerm[]
  help: HelpResource[]
}

const Ctx = createContext<ClientViewer | null>(null)

export function ViewerProvider({ value, children }: { value: ClientViewer; children: ReactNode }) {
  return <Ctx value={value}>{children}</Ctx>
}

export function useViewer(): ClientViewer {
  const v = use(Ctx)
  if (!v) throw new Error('useViewer ausserhalb von ViewerProvider')
  return v
}

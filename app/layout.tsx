import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import type { ReactNode } from 'react'
import { DiscreetGuard } from '@/components/discreet'
import { PanicGuard } from '@/components/panic'
import { Toaster } from '@/components/toast'
import { PREFS_SCRIPT } from '@/lib/prefs-script'
import { m } from '@/messages'
import './globals.css'

const sans = localFont({ src: './fonts/Geist-Variable.woff2', variable: '--font-sans', weight: '100 900', display: 'swap' })
const serif = localFont({
  src: [
    { path: './fonts/instrument-serif-latin-400-normal.woff2', style: 'normal', weight: '400' },
    { path: './fonts/instrument-serif-latin-400-italic.woff2', style: 'italic', weight: '400' },
  ],
  variable: '--font-serif',
  display: 'swap',
})

// Pro Anfrage (Sprache); vorgerenderte Seiten bekommen die deutsche Beschreibung.
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: { default: m.brand, template: `%s · ${m.brand}` },
    description: m.meta.description,
    applicationName: m.brand,
    appleWebApp: { capable: true, title: m.brand, statusBarStyle: 'default' },
    icons: { apple: '/icons/apple-touch-icon.png' },
    robots: { index: true, follow: true },
    referrer: 'no-referrer',
  }
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#EFECE4' },
    { media: '(prefers-color-scheme: dark)', color: '#171715' },
  ],
  // Die Bildschirmtastatur verkleinert den Inhalt (dvh), statt ihn zu überdecken – «Teilen» bleibt sichtbar.
  interactiveWidget: 'resizes-content',
  width: 'device-width',
  initialScale: 1,
  // Bis an den Rand (iPhone); die untere Leiste hält per env(safe-area-inset-bottom) Abstand zum Home-Indikator.
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de-CH" className={`${sans.variable} ${serif.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREFS_SCRIPT }} />
      </head>
      <body>
        {children}
        <Toaster />
        <PanicGuard />
        <DiscreetGuard />
      </body>
    </html>
  )
}

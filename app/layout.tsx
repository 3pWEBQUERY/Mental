import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import type { ReactNode } from 'react'
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

export const metadata: Metadata = {
  title: { default: m.brand, template: `%s · ${m.brand}` },
  description: m.meta.description,
  applicationName: m.brand,
  appleWebApp: { capable: true, title: m.brand, statusBarStyle: 'default' },
  icons: { apple: '/icons/apple-touch-icon.png' },
  robots: { index: true, follow: true },
  referrer: 'no-referrer',
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#EFECE4' },
    { media: '(prefers-color-scheme: dark)', color: '#171715' },
  ],
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de" className={`${sans.variable} ${serif.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREFS_SCRIPT }} />
      </head>
      <body>
        {children}
        <Toaster />
        <PanicGuard />
      </body>
    </html>
  )
}

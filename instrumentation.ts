import type { Instrumentation } from 'next'
import { safeMessage } from './lib/log-safe'

/** Beim Serverstart: Sprache pro Anfrage für `m` (messages/index.ts). */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { registerLocaleResolver } = await import('./lib/server/request-locale')
    registerLocaleResolver()
  }
}

/**
 * Fehler protokollieren, ohne Inhalte zu sehen: nur Route, Methode und Digest –
 * nie Request-Bodies, Cookies, Header oder Abfrage-Parameter.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const digest = (error as { digest?: string }).digest ?? 'ohne-digest'
  console.error(`[fehler] ${request.method} ${context.routePath} (${context.routeType}) digest=${digest}: ${safeMessage(error, 200)}`)
}

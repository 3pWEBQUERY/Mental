import type { Instrumentation } from 'next'
import { safeMessage } from './lib/log-safe'

/**
 * Fehler protokollieren, ohne Inhalte zu sehen: nur Route, Methode und Digest –
 * nie Request-Bodies, Cookies, Header oder Abfrage-Parameter.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const digest = (error as { digest?: string }).digest ?? 'ohne-digest'
  console.error(`[fehler] ${request.method} ${context.routePath} (${context.routeType}) digest=${digest}: ${safeMessage(error, 200)}`)
}

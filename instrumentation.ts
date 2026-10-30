import type { Instrumentation } from 'next'

/**
 * Fehler protokollieren, ohne Inhalte zu sehen: nur Route, Methode und Digest –
 * nie Request-Bodies, Cookies oder Header.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const digest = (error as { digest?: string }).digest ?? 'ohne-digest'
  console.error(`[fehler] ${request.method} ${context.routePath} (${context.routeType}) digest=${digest}: ${(error as Error).message?.slice(0, 200)}`)
}

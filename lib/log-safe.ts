/**
 * Fehlermeldungen für die Logs – ohne Daten. Drizzle hängt an fehlgeschlagene Abfragen die Parameter an
 * («Failed query: … params: <Konto-ID>, <Text>»); die gehören nicht ins Railway-Log.
 */
export function safeMessage(e: unknown, max = 300): string {
  const raw = e instanceof Error ? e.message : String(e)
  return raw.replace(/\bparams:[\s\S]*$/i, 'params: [entfernt]').replace(/\s+/g, ' ').slice(0, max)
}

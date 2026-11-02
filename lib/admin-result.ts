/** Antwort der Admin-Aktionen für Kreise, Hilfe und Schritte: Meldung für den Toast oder Fehler am Formular. */
export type AdminResult = { ok: true; message: string } | { ok: false; error: string }

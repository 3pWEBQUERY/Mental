/**
 * Was im Browser liegen bleibt, obwohl niemand mehr angemeldet ist: der Entwurf im Composer und die Liste der
 * aufgedeckten belastenden Gedanken, dazu die freiwillige Offline-Kopie des Notfallplans. Auf einem geteilten Gerät sähe die nächste Person sonst «Entwurf
 * wiederhergestellt» mit dem Text. Gelöscht wird beim Schnell-Ausblenden und auf der Anmeldeseite (nach dem
 * Abmelden oder wenn die Sitzung abgelaufen ist).
 */
export const DRAFT_KEY = 'lichtung-draft'
export const REVEALED_KEY = 'lichtung-revealed'
/** Freiwillige Offline-Kopie des Notfallplans (nur auf diesem Gerät, bis zum Abmelden). Liest auch /offline. */
export const PLAN_KEY = 'lichtung-plan-offline'

export function forgetPrivate() {
  try {
    localStorage.removeItem(DRAFT_KEY)
    localStorage.removeItem(REVEALED_KEY)
    localStorage.removeItem(PLAN_KEY)
  } catch {}
}

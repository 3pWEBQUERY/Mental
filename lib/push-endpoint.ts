/**
 * Push-Abos zeigen nur auf die bekannten Push-Dienste der Browser. Sonst liesse sich als «Endpoint» eine interne
 * Adresse hinterlegen (z. B. die Datenbank im privaten Netz), und der Worker schickte bei jeder Antwort einen POST
 * dorthin (SSRF).
 */
const HOSTS = [
  /^fcm\.googleapis\.com$/, // Chrome, Edge (Android), Opera, Samsung
  /^([a-z0-9-]+\.)*push\.services\.mozilla\.com$/, // Firefox
  /^web\.push\.apple\.com$/, // Safari (macOS, iOS als Web-App)
  /^([a-z0-9-]+\.)*push\.apple\.com$/,
  /^([a-z0-9-]+\.)*notify\.windows\.com$/, // Edge (Windows, WNS)
]

export function isPushEndpoint(raw: string): boolean {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return false
  }
  if (u.protocol !== 'https:' || (u.port && u.port !== '443') || u.username || u.password) return false
  const host = u.hostname.toLowerCase()
  return HOSTS.some((re) => re.test(host))
}

/** Mehr Geräte braucht niemand – und unbegrenzt viele Abos würden jede Antwort vervielfachen. */
export const MAX_PUSH_SUBSCRIPTIONS = 5

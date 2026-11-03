import { isIP } from 'node:net'

/**
 * Railways Edge setzt X-Real-IP auf die echte Client-IP (docs.railway.com/networking/public-networking/specs-and-limits).
 * Der erste Eintrag in X-Forwarded-For kommt dagegen vom Client und ist frei wählbar – sonst liessen sich
 * alle IP-Limits mit einem erfundenen Header umgehen. Als Rückfall zählt darum nur der letzte, vom Proxy angehängte Eintrag.
 *
 * X-Real-IP gilt nur hinter Railway (RAILWAY_ENVIRONMENT gesetzt) oder mit TRUST_X_REAL_IP=1 – ohne einen Proxy,
 * der ihn überschreibt, könnte ihn jeder Client selbst setzen. Und nur, wenn er wirklich eine IP-Adresse ist:
 * Beliebige Werte ergäben beliebig viele Limit-Töpfe.
 */
export function clientIp(h: Pick<Headers, 'get'>): string {
  const env = process.env
  const trustReal = Boolean(env.RAILWAY_ENVIRONMENT_ID || env.RAILWAY_ENVIRONMENT_NAME || env.RAILWAY_ENVIRONMENT) || env.TRUST_X_REAL_IP === '1'
  const real = trustReal ? clean(h.get('x-real-ip')) : null
  if (real) return real
  const hops = h.get('x-forwarded-for')?.split(',').map((x) => x.trim()).filter(Boolean)
  return clean(hops?.at(-1)) ?? 'unknown'
}

/** Nur gültige IPv4/IPv6-Adressen (ohne Port, ohne Klammern), sonst null. */
function clean(v: string | null | undefined): string | null {
  if (!v) return null
  let ip = v.trim()
  if (ip.startsWith('[')) ip = ip.slice(1, ip.indexOf(']') > 0 ? ip.indexOf(']') : undefined)
  else if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(ip)) ip = ip.slice(0, ip.lastIndexOf(':'))
  return ip.length <= 64 && isIP(ip.split('%')[0]!) ? ip : null
}

/**
 * Für Limits zählt bei IPv6 das ganze /64-Netz: Ein Anschluss bekommt meist ein /64 und kann darin beliebig viele
 * Adressen nutzen – pro Einzeladresse liesse sich jedes Limit umgehen. IPv4 bleibt unverändert.
 */
export function ipBucket(ip: string): string {
  const v6 = ip.replace(/^\[|\]$/g, '').split('%')[0]!
  if (!v6.includes(':')) return ip
  // In IPv6 eingebettete IPv4 (::ffff:1.2.3.4) ist eine IPv4.
  const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)
  if (mapped) return mapped[1]!
  const [head = '', tail = ''] = v6.split('::')
  const h = head ? head.split(':') : []
  const t = v6.includes('::') ? (tail ? tail.split(':') : []) : []
  const groups = v6.includes('::') ? [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t] : h
  return `${groups
    .slice(0, 4)
    .map((g) => (parseInt(g || '0', 16) || 0).toString(16))
    .join(':')}::/64`
}

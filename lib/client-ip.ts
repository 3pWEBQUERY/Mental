/**
 * Railways Edge setzt X-Real-IP auf die echte Client-IP (docs.railway.com/networking/public-networking/specs-and-limits).
 * Der erste Eintrag in X-Forwarded-For kommt dagegen vom Client und ist frei wählbar – sonst liessen sich
 * alle IP-Limits mit einem erfundenen Header umgehen. Als Rückfall zählt darum nur der letzte, vom Proxy angehängte Eintrag.
 */
export function clientIp(h: Pick<Headers, 'get'>): string {
  const real = h.get('x-real-ip')?.trim()
  if (real) return real
  const hops = h.get('x-forwarded-for')?.split(',').map((x) => x.trim()).filter(Boolean)
  return hops?.at(-1) || 'unknown'
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

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

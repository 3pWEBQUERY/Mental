/** Deterministischer Zufall (mulberry32) – gleiche Saat, gleiche Form. */
export function rng(seed: number) {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const WOBBLE = [0.3, 0.24, 0.18, 0.14, 0.1]

/** Organische Form statt Profilbild – flache Farbe, keine Verläufe. Unruhiger bei schwerer Stimmung. */
export function glyphPath(seed: number, mood: number): string {
  const r = rng(seed)
  const n = 7
  const wob = WOBBLE[mood] ?? 0.18
  const pts: [number, number][] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const rad = 15 * (1 - wob + r() * wob * 2)
    pts.push([20 + Math.cos(a) * rad, 20 + Math.sin(a) * rad])
  }
  const mid = (a: [number, number], b: [number, number]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as const
  const f = (v: number) => v.toFixed(1)
  const start = mid(pts[n - 1]!, pts[0]!)
  let d = `M${f(start[0])} ${f(start[1])}`
  for (let i = 0; i < n; i++) {
    const p = pts[i]!
    const q = mid(p, pts[(i + 1) % n]!)
    d += ` Q${f(p[0])} ${f(p[1])} ${f(q[0])} ${f(q[1])}`
  }
  return `${d}Z`
}

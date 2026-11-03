/**
 * Atemmuster für den Raum. Jede Phase hat eine Dauer in Sekunden; «rest» ist das Halten mit leerer Lunge (Box).
 * - calm  4-2-6:   länger aus als ein – beruhigt (Standard, wie bisher)
 * - box   4-4-4-4: vier gleiche Takte – sammelt
 * - relax 4-7-8:   lange halten, lange aus – zum Runterkommen, z. B. vor dem Schlafen
 * Dauer 1, 3 oder 5 Minuten: so viele ganze Runden, wie am besten passen (mindestens eine).
 */
export type BreathPhase = 'inhale' | 'hold' | 'exhale' | 'rest'
export const BREATH_PATTERNS = {
  calm: [['inhale', 4], ['hold', 2], ['exhale', 6]],
  box: [['inhale', 4], ['hold', 4], ['exhale', 4], ['rest', 4]],
  relax: [['inhale', 4], ['hold', 7], ['exhale', 8]],
} as const satisfies Record<string, readonly (readonly [BreathPhase, number])[]>
export type BreathPatternId = keyof typeof BREATH_PATTERNS
export const BREATH_PATTERN_IDS = Object.keys(BREATH_PATTERNS) as BreathPatternId[]
export const BREATH_MINUTES = [1, 3, 5] as const
export type BreathMinutes = (typeof BREATH_MINUTES)[number]

export type BreathPlan = { phases: readonly (readonly [BreathPhase, number])[]; cycle: number; cycles: number; total: number }

export function breathPlan(id: BreathPatternId = 'calm', minutes: BreathMinutes = 1): BreathPlan {
  const phases = BREATH_PATTERNS[id] ?? BREATH_PATTERNS.calm
  const cycle = phases.reduce((s, [, d]) => s + d, 0)
  const cycles = Math.max(1, Math.round((minutes * 60) / cycle))
  return { phases, cycle, cycles, total: cycle * cycles }
}

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

/** Stand nach t Sekunden: Phase, Füllung der Lunge (0–1, für die Kugel) und verbleibende Sekunden. null = fertig. */
export function breathAt(plan: BreathPlan, t: number): { phase: BreathPhase; level: number; left: number } | null {
  if (t >= plan.total) return null
  let x = t % plan.cycle
  for (const [phase, d] of plan.phases) {
    if (x < d) {
      const level = phase === 'inhale' ? ease(x / d) : phase === 'hold' ? 1 : phase === 'exhale' ? 1 - ease(x / d) : 0
      return { phase, level, left: Math.ceil(plan.total - t) }
    }
    x -= d
  }
  return { phase: 'rest', level: 0, left: Math.ceil(plan.total - t) }
}

export const isBreathPattern = (v: unknown): v is BreathPatternId => typeof v === 'string' && v in BREATH_PATTERNS
export const isBreathMinutes = (v: unknown): v is BreathMinutes => BREATH_MINUTES.includes(v as BreathMinutes)

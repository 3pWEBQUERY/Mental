import { glyphPath } from '@/lib/glyph'

/** Bäume als ruhige Linien: Stamm und eine schmale, offene Krone. */
function Tree({ x, base, h, w }: { x: number; base: number; h: number; w: number }) {
  const top = base - h
  return (
    <g className="tree">
      <path d={`M${x} ${base}V${top + h * 0.55}`} />
      <path d={`M${x} ${top}C${x + w} ${top + h * 0.22} ${x + w * 0.9} ${top + h * 0.5} ${x} ${top + h * 0.62}C${x - w * 0.9} ${top + h * 0.5} ${x - w} ${top + h * 0.22} ${x} ${top}Z`} />
    </g>
  )
}

const PEOPLE = [
  { seed: 1307, mood: 3, x: 158, y: 318, s: 1.15 },
  { seed: 4211, mood: 4, x: 196, y: 324, s: 1.3 },
  { seed: 9083, mood: 1, x: 234, y: 320, s: 1.1 },
  { seed: 2719, mood: 0, x: 266, y: 314, s: 0.9 },
]

const HORIZON = 'M24 300C96 288 152 284 200 284S304 288 376 300'

/**
 * Die Lichtung: Zwischen den Bäumen geht ein warmes Licht auf, davor sitzen ein paar Menschen
 * beieinander – die gleichen organischen Formen wie im Feed. Das Licht atmet langsam (4 s ein, 6 s aus).
 * Flache Farben, keine Verläufe.
 */
export function ClearingArt() {
  return (
    <svg className="clearing" viewBox="0 0 400 400" role="img" aria-label="Eine Lichtung im Wald, über der ein warmes Licht aufgeht; davor sitzen Menschen beieinander">
      <g className="breath">
        <circle className="glow" cx="200" cy="284" r="168" />
        <circle className="halo" cx="200" cy="284" r="104" />
        <circle className="sun" cx="200" cy="284" r="62" />
      </g>
      {/* Boden deckt die untere Hälfte des Lichts ab: Es geht hinter der Lichtung auf. */}
      <path className="earth" d={`${HORIZON}V400H24Z`} />
      <path className="ground" d={HORIZON} />
      <path className="ground faint" d="M70 336C134 326 172 324 200 324S266 326 330 336" />
      <path className="ground faint" d="M118 362C150 356 178 355 200 355S250 356 282 362" />
      <Tree x={40} base={306} h={214} w={21} />
      <Tree x={76} base={298} h={168} w={18} />
      <Tree x={106} base={292} h={118} w={14} />
      <Tree x={294} base={292} h={126} w={14} />
      <Tree x={326} base={298} h={176} w={19} />
      <Tree x={360} base={306} h={220} w={22} />
      {PEOPLE.map((p) => (
        <path
          key={p.seed}
          className="person"
          d={glyphPath(p.seed, p.mood)}
          transform={`translate(${p.x - 20 * p.s} ${p.y - 36 * p.s}) scale(${p.s})`}
          fill={`var(--mood-${p.mood})`}
        />
      ))}
    </svg>
  )
}

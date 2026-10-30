/** Gemeinsame Komposition für die Three.js-Szene und ihren SVG-Fallback (Koordinaten in Szenen-Einheiten). */
export const LIGHT = { x: 0, y: 0.35, r: 0.9 }

/**
 * Menschen sitzen als Gruppe im Halbkreis unten um das Feuer – nah beieinander, teils überlappend,
 * nie gleichmässig verteilt (keine Umlaufbahn).
 */
export const PEOPLE = [
  { x: -2.75, y: -0.35, r: 0.56, mood: 3, seed: 1.3 },
  { x: -2.15, y: -1.55, r: 0.68, mood: 1, seed: 4.2 },
  { x: -0.95, y: -2.2, r: 0.58, mood: 4, seed: 9.1 },
  { x: 0.35, y: -2.4, r: 0.74, mood: 0, seed: 2.7 },
  { x: 1.6, y: -1.95, r: 0.52, mood: 3, seed: 6.6 },
  { x: 2.45, y: -0.95, r: 0.64, mood: 1, seed: 7.9 },
  { x: 2.8, y: 0.3, r: 0.42, mood: 4, seed: 3.4 },
] as const

/** Sichtbare Höhe der Szene in Einheiten; die Breite folgt dem Seitenverhältnis. */
export const VIEW_HEIGHT = 7.6

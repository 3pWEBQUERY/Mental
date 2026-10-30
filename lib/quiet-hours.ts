/** Ruhezeiten, z. B. 22–07 Uhr: über Mitternacht hinweg korrekt. */
export function inQuietHours(hour: number, from: number, to: number) {
  if (from === to) return false
  return from < to ? hour >= from && hour < to : hour >= from || hour < to
}

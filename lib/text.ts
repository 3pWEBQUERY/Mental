/** Normalisiert Text für die Erkennung: klein, ohne Umlaute/Akzente, ohne Satzzeichen. */
export function normalize(input: string): string {
  return ` ${input
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()} `
}

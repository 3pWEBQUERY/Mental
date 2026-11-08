/** Normalisiert Text für die Erkennung: klein, ohne Umlaute/Akzente, ohne Satzzeichen. */
export function normalize(input: string): string {
  // Erst zusammensetzen (NFC): Aus PDF oder macOS kopierte Umlaute kommen als «u» + Trema-Zeichen und würden
  // sonst zu «u» statt «ue» – «lebensmüde» träfe dann «lebensmued*» nicht.
  return ` ${input
    .normalize('NFC')
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

/** ae/oe/ue → a/o/u: «mochte sterben» (ohne Umlaut getippt) trifft so auch «moechte sterben». */
export function foldUmlauts(normalized: string): string {
  return normalized.replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u')
}

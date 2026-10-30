/** Erzeugt die PWA-Icons aus dem Logo (einmalig, Ergebnis liegt in public/icons). */
import sharp from 'sharp'

const svg = (size: number, pad: number) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#EFECE4"/>
  <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - pad}" fill="none" stroke="#1C1C1A" stroke-width="${size * 0.028}"/>
  <circle cx="${size / 2}" cy="${size / 2}" r="${(size / 2 - pad) * 0.39}" fill="#C4583A"/>
</svg>`

for (const [name, size, pad] of [
  ['icon-192.png', 192, 30],
  ['icon-512.png', 512, 80],
  ['maskable-512.png', 512, 130],
  ['apple-touch-icon.png', 180, 28],
] as const) {
  await sharp(Buffer.from(svg(size, pad))).png().toFile(`public/icons/${name}`)
}
console.log('Icons erzeugt.')

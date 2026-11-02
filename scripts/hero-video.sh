#!/usr/bin/env bash
# Hintergrund-Video der Startseite aus einem Quell-Video bauen (ffmpeg mit libsvtav1 und libx264, dazu Node mit sharp).
#   scripts/hero-video.sh pfad/zum/video.mp4 [ausgabe-ordner]
#
# 1. Einzelbilder: Querformat 1920×1080 und Hochformat-Ausschnitt 720×1280 aus der Bildmitte.
# 2. Schleife: Die ersten 1,5 s werden ans Ende überblendet – so springt die Wiedergabe nie (Länge = Quelle − 1,5 s).
# 3. Je Format AV1 (klein) und H.264 (läuft überall), ohne Ton, «faststart» für sofortiges Abspielen.
# 4. Standbilder = erstes Bild der Schleife (components/landing/hero-poster*.webp).
# Neue Fassung immer in einen neuen Ordner (public/hero/v2 …) und BASE in components/landing/hero-video.tsx anpassen:
# Die Dateien werden ein Jahr lang im Browser zwischengespeichert.
set -euo pipefail
SRC="$1"
OUT="${2:-public/hero/v1}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$OUT" "$TMP/d" "$TMP/m"

read -r W H < <(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0:s=' ' "$SRC")
CW=$(( H * 9 / 16 / 2 * 2 ))       # Breite des 9:16-Ausschnitts
CX=$(( (W - CW) / 2 ))
FPS=24
FADE_FRAMES=36                     # 1,5 s bei 24 fps

ffmpeg -v error -y -i "$SRC" -an -vf "fps=$FPS,scale=1920:1080:flags=lanczos" -q:v 2 "$TMP/d/%03d.jpg"
ffmpeg -v error -y -i "$SRC" -an -vf "fps=$FPS,crop=$CW:$H:$CX:0,scale=720:1280:flags=lanczos" -q:v 2 "$TMP/m/%03d.jpg"
N=$(ls "$TMP/d" | wc -l)
OFFSET=$(awk "BEGIN { print ($N - $FADE_FRAMES) / $FPS - $FADE_FRAMES / $FPS }")

loop() { # quelle ausgabe codec-argumente…
  local dir="$1" out="$2"; shift 2
  ffmpeg -v error -y -framerate $FPS -start_number $((FADE_FRAMES + 1)) -i "$dir/%03d.jpg" -framerate $FPS -start_number 1 -i "$dir/%03d.jpg" \
    -filter_complex "[1:v]trim=end_frame=$FADE_FRAMES,setpts=PTS-STARTPTS[b];[0:v]setpts=PTS-STARTPTS[a];[a][b]xfade=transition=fade:duration=$(awk "BEGIN { print $FADE_FRAMES / $FPS }"):offset=$OFFSET,format=yuv420p[v]" \
    -map "[v]" -an -movflags +faststart "$@" "$out"
}
for f in d:desktop m:mobile; do
  loop "$TMP/${f%%:*}" "$OUT/${f##*:}-av1.mp4" -c:v libsvtav1 -crf 42 -preset 6 -g 240
  loop "$TMP/${f%%:*}" "$OUT/${f##*:}-h264.mp4" -c:v libx264 -crf 28 -preset slow -g 240 -profile:v high
done

# Standbilder: Bild Nr. FADE_FRAMES der Quelle in voller Auflösung = erstes Bild der Schleife.
ffmpeg -v error -y -i "$SRC" -vf "fps=$FPS,select='eq(n\,$FADE_FRAMES)'" -frames:v 1 "$TMP/poster.png"
node -e "
const sharp = require('sharp')
const [p, cw, cx] = process.argv.slice(1)
sharp(p).resize(2560).webp({ quality: 78 }).toFile('components/landing/hero-poster.webp')
sharp(p).extract({ left: +cx, top: 0, width: +cw, height: $H }).resize(1080).webp({ quality: 78 }).toFile('components/landing/hero-poster-m.webp')
" "$TMP/poster.png" "$CW" "$CX"
ls -la "$OUT"

# Lichtung

Ein ruhiger, anonymer Ort, an dem Menschen Gedanken teilen und Zuspruch bekommen. Aufgebaut wie ein Feed, aber ohne Likes, ohne Follower, ohne Profilbilder und ohne Rangliste. Wer in einer Krise ist, findet in Sekunden echte Hilfe (143 · 147 · 144).

Umsetzung der PRD «Lichtung – Product Requirements Document» im Design des Entwurfs `lichtung.html`: Instrument Serif + Geist, flache Farben, keine Schatten, keine Verläufe. Bewegung kommt nur aus dem Three.js-Raum.

## Stack

| Schicht | Wahl |
| --- | --- |
| Framework | Next.js 16.4 (App Router, Cache Components, Partial Prefetching, Turbopack), React 19.3, TypeScript strict |
| Datenbank | Postgres + Drizzle ORM, Migrationen mit Drizzle Kit |
| Auth | eigene Sitzungen in Postgres, Argon2id, Wiederherstellungsschlüssel, Passkeys (SimpleWebAuthn) |
| Jobs | pg-boss im Worker-Service (Queue in Postgres) |
| Medien | Railway Storage Bucket (S3), signierte URLs, sharp im Worker |
| Bot-Schutz | ALTCHA (Proof-of-Work, selbst gehostet) |
| Tests | Vitest (Unit), Playwright (E2E) |

## Lokal starten

```bash
cp .env.example .env            # DATABASE_URL, SESSION_SECRET, APP_URL setzen
npm install
npm run db:migrate              # bzw. npx drizzle-kit migrate
npm run db:seed                 # Kreise, Hilfe-Nummern, Krisen-Wortliste, kleine Schritte
npm run db:demo                 # optional: Beispielinhalte (Login demo.mira / lichtung-demo-2026)
npm run dev                     # Web auf :3000
npm run worker                  # zweites Terminal: Hintergrundjobs
```

Moderationsrolle vergeben – lokal über die Kommandozeile, auf Railway über die Variable `ADMIN_USERNAMES` (kommagetrennt) am `web`-Service; `scripts/bootstrap-admins.ts` vergibt die Rolle beim nächsten Deploy und stuft nie herab:

```bash
npm run admin:grant -- <benutzername> admin
```

Der Moderationsbereich `/admin` verlangt eine Sitzung, die per Passkey begonnen hat. Lokal hebt `ADMIN_ALLOW_PASSWORD=1` das auf; in Produktion wirkt das nie.

## Tests

```bash
npm test                        # Unit, inkl. Test gegen Datenlecks in öffentlichen DTOs
npm run build && npm run test:e2e
```

E2E deckt Registrierung, Login, Wiederherstellung, Teilen, Zuspruch, Antworten, Benachrichtigungen, Krisenerkennung, Datenmarkierung, Melden, Blockieren, Löschen, Hilfe-Erreichbarkeit, Schnell-Ausblenden, Kontolöschung und das mobile Layout ab.

## Deployment auf Railway

Projekt «Lichtung», alles in **EU West (Amsterdam)**. Config-as-Code (`railway.json`) liest Railway für neue Services nicht mehr; die Einstellungen liegen direkt an den Services:

| Service | Einstellungen |
| --- | --- |
| `web` | Build `npm run build`, Start `npm run start`, Pre-Deploy `npx drizzle-kit migrate && npx tsx db/seed.ts && npx tsx scripts/bucket-cors.ts && npx tsx scripts/bootstrap-admins.ts`, Healthcheck `/api/health`, 2 Replikas, Region `europe-west4-drams3a` |
| `worker` | Start `npm run worker`, Restart immer, 1 Replika, Region `europe-west4-drams3a` |
| `Postgres` | Railway-Template, Volume in `europe-west4-drams3a` |
| `media` | Storage Bucket (privat), Region `ams` |

Variablen beider Services: `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `BUCKET`/`ACCESS_KEY_ID`/`SECRET_ACCESS_KEY`/`REGION`/`ENDPOINT` als `${{media.*}}`-Referenzen, `APP_URL`, `VAPID_*`; im Web zusätzlich `SESSION_SECRET`. Die CORS-Regel des Buckets (PUT, nur `APP_URL`) setzt `scripts/bucket-cors.ts` bei jedem Deploy selbst. VAPID-Schlüssel erzeugen mit `npm run vapid:generate`.

## Architektur in Kürze

- `app/(public)` – Landing, Hilfe (`ensureStatic = 'navigation'`, funktioniert ohne DB), Regeln, Datenschutz
- `app/(auth)` – Anmelden, Registrieren (7 Schritte), Wiederherstellen
- `app/(app)` – Lichtung (Feed), Ich, Einstellungen; Server Actions für alle Schreibvorgänge
- `app/admin` – Warteschlange, Kreise, Hilfe-Nummern, Krisen-Wortliste, kleine Schritte, Audit-Log
- `app/api` – Upload-URL, Medien (302 auf signierte URL), SSE für die Glocke, Export, Healthcheck
- `components/raum` – Three.js-Kugel, per `next/dynamic` ohne SSR geladen
- `lib/dto.ts` – `toPublicPost()`: öffentliche Daten enthalten nie `user_id` oder `username`
- `worker/` – Bildverarbeitung, Moderation (Stufe 2), Push, Export, Löschung, Aufräumen
- `proxy.ts` – CSP mit Nonce, Weiterleitung geschützter Routen

### Bewusste Entscheidungen

- **Eigene Sitzungen statt Better Auth.** Better Auth verlangt in seinem Kernschema eine E-Mail-Adresse. Die PRD verbietet genau das. Sitzungen, Argon2id, Rate-Limits und Passkeys sind deshalb direkt umgesetzt, nach dem Datenmodell der PRD.
- **Strikte CSP mit Nonce** auf allen Seiten mit Sitzung oder Nutzerinhalten. Diese Seiten werden pro Request gerendert, weil vorgerendertes HTML keine Nonce tragen kann. Die rein statischen Seiten (Landing, Hilfe, Regeln, Datenschutz, Offline) erlauben die von Next.js eingebetteten Inline-Skripte; sie enthalten keine Nutzerinhalte.
- **HEIC** wandelt der Browser vor dem Upload in JPEG um. Der vorgebaute sharp-Build kann HEVC nicht dekodieren, und so erreichen den Worker nur Formate, die er sicher neu kodieren kann.
- **Bilder:** Upload direkt in den Bucket (`quarantine/<id>`). Der Worker prüft das Format, entfernt EXIF/GPS und kodiert neu (WebP + AVIF). Danach wartet das Bild in `/admin/bilder`, bis die Moderation (Rolle `mod` oder `admin`) es freigibt oder ablehnt. Hängt ein Bild noch in der Quarantäne, bereinigt die Freigabe es direkt im Web-Service. Bis dahin sieht nur die Verfasserin «Bild wird geprüft …», alle anderen sehen kein Bild.
- **Moderation, Stufe 2:** läuft immer lokal (Wortliste + Heuristik) und fragt zusätzlich einen Anbieter, sobald `MODERATION_API_URL` gesetzt ist. Welcher Anbieter das wird, ist eine offene Frage der PRD.
- **Fehler-Monitoring:** `instrumentation.ts` protokolliert nur Route und Digest, keine Inhalte. Sentry (EU-Region) ist noch nicht angebunden.

## Offene Punkte aus der PRD

Moderations-Anbieter (EU/CH, versteht Mundart), Besetzung des Moderationsteams 06–24 Uhr, fachliche Abnahme der Krisenlogik und Wortliste, rechtliche Prüfung (nDSG), externer Pentest, Mindestalter 16 oder 18, Finanzierung. Version 1.1: weitere Atemmuster, Peer-Moderation (Rollen und Rechte sind schon angelegt).

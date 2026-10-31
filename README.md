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

Moderationsrolle vergeben – lokal über die Kommandozeile, auf Railway über die Variable `ADMIN_USER_IDS` (Konto-IDs, kommagetrennt) am `web`-Service; `scripts/bootstrap-admins.ts` vergibt die Rolle beim nächsten Deploy und stuft nie herab. Bewusst IDs statt Benutzernamen: Ein Name wird nach einer Löschung wieder frei, eine ID nie.

```bash
npm run admin:grant -- <benutzername> admin
```

Danach im Moderationsbereich: Auf der Kontoseite schlägt ein Admin eine neue Rolle vor, ein **zweiter** Admin bestätigt (Vier-Augen-Prinzip, Vorschlag verfällt nach 7 Tagen, alles im Audit-Log). Die Kommandozeile bleibt für den ersten Admin und für Notfälle.

Der Moderationsbereich `/admin` verlangt eine Sitzung, die per Passkey begonnen hat. Lokal hebt `ADMIN_ALLOW_PASSWORD=1` das auf; in Produktion wirkt das nie.

## Tests

```bash
npm test                        # Unit, inkl. Test gegen Datenlecks in öffentlichen DTOs
npm run build && npm run test:e2e
```

E2E läuft jedes Mal gegen eine frisch angelegte Datenbank `<name>_e2e` neben `DATABASE_URL` (siehe `playwright.config.ts`); die Rolle braucht dafür das Recht, Datenbanken anzulegen.

E2E deckt Registrierung, Login, Wiederherstellung, Teilen, Zuspruch, Antworten, Benachrichtigungen, Krisenerkennung, Datenmarkierung, Melden, Blockieren, Löschen, Hilfe-Erreichbarkeit, Schnell-Ausblenden, Kontolöschung und das mobile Layout ab.

## Deployment auf Railway

Projekt «Lichtung», alles in **EU West (Amsterdam)**. Config-as-Code (`railway.json`) liest Railway für neue Services nicht mehr; die Einstellungen liegen direkt an den Services:

| Service | Einstellungen |
| --- | --- |
| `web` | Build `npm run build`, Start `npm run start`, Pre-Deploy `npx drizzle-kit migrate && npx tsx db/seed.ts && npx tsx scripts/bucket-cors.ts && npx tsx scripts/bootstrap-admins.ts`, Healthcheck `/api/health`, 2 Replikas, Region `europe-west4-drams3a` |
| `worker` | Start `npm run worker`, Restart immer, 1 Replika, Region `europe-west4-drams3a`. Wartet beim Start, bis alle Migrationen angewendet sind (die laufen im Pre-Deploy von `web`). |
| `monitor` | Cron-Service, Start `npm run monitor`, Zeitplan `*/5 * * * *`, Restart nie, Region `europe-west4-drams3a`. Variablen `DATABASE_URL`, `VAPID_*`. |
| `Postgres` | Railway-Template, Volume in `europe-west4-drams3a` |
| `media` | Storage Bucket (privat), Region `ams` |

**Überwachung:** `/api/health` prüft nur die Datenbank (Railway-Healthcheck des Web-Service). Der Cron-Service `monitor` (`scripts/monitor.ts`) prüft alle 5 Minuten das Lebenszeichen des Workers und den Stau in den Warteschlangen; bei einer Störung bekommen Admins und Moderator:innen einmalig eine Benachrichtigung «Betrieb» in der Glocke und per Push, danach eine Entwarnung. Zusätzlich antwortet `/api/health/worker` mit 503, wenn der Worker schweigt – für einen externen Uptime-Dienst, der auch einen Ausfall von ganz Railway bemerken würde. Fehlgeschlagene Jobs und pg-boss-Warnungen stehen im Log des Workers.

Variablen beider Services: `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `BUCKET`/`ACCESS_KEY_ID`/`SECRET_ACCESS_KEY`/`REGION`/`ENDPOINT` als `${{media.*}}`-Referenzen, `APP_URL`, `VAPID_*`; im Web zusätzlich `SESSION_SECRET`. Die CORS-Regel des Buckets (PUT, nur `APP_URL`) setzt `scripts/bucket-cors.ts` bei jedem Deploy selbst. VAPID-Schlüssel erzeugen mit `npm run vapid:generate`.

### Verschlüsselung besonders schützenswerter Daten

Notfallplan, Briefe an sich selbst und Check-in-Notizen werden mit AES-256-GCM verschlüsselt gespeichert, sobald `DATA_ENCRYPTION_KEY` gesetzt ist (32 Byte Base64: `openssl rand -base64 32`). Der Schlüssel gehört in **web und worker**, nie in die Datenbank – und muss zusätzlich offline gesichert werden (Passwort-Manager des Teams): **Ohne ihn sind diese Texte nicht mehr lesbar**, auch nicht aus Backups. Den Schlüssel nur am web-Service eintragen, der worker übernimmt ihn per Referenz (`DATA_ENCRYPTION_KEY=${{web.DATA_ENCRYPTION_KEY}}`). Der Pre-Deploy des web-Service führt danach `scripts/encrypt-at-rest.ts` aus und verschlüsselt alte Klartext-Werte; das ist beliebig wiederholbar und ohne Schlüssel wirkungslos. Ohne Schlüssel läuft alles wie bisher im Klartext. Das Tagebuch ist unabhängig davon Ende-zu-Ende verschlüsselt (Schlüssel nur bei der Person).

### Backups und Wiederherstellung

- **Postgres:** In Railway beim Service `Postgres` → *Backups* geplante Volume-Backups einschalten (täglich, Aufbewahrung höchstens 30 Tage – so steht es in der Datenschutzerklärung) und optional Point-in-Time-Recovery (`railway postgres pitr`). Restore: Backup wählen → *Restore* → gestagte Änderung prüfen → *Deploy*.
- **Bucket (Bilder, Exporte):** Bilder sind ersetzbar (die Gedanken bleiben ohne Bild bestehen); Exporte leben nur 24 Stunden. Kein eigenes Backup nötig.
- **Gelöscht bleibt gelöscht:** Jede Löschung (Gedanke, Konto) landet im Lösch-Journal im Bucket (`deletions/`, nur Art, ID, Zeitpunkt; 60 Tage). Nach jedem Restore **sofort** `npm run data:replay-deletions -- JJJJ-MM-TT` (Datum des Backups) ausführen – sonst kämen gelöschte Konten und losgelassene Gedanken zurück.
- **Probe:** Einmal pro Quartal ein Backup in eine Test-Umgebung zurückspielen und das Replay laufen lassen.

### Aufbewahrung (Job `apply-retention`, täglich)

Benachrichtigungen 30 Tage · erledigte Meldungen nach 12 Monaten ohne Notiz und ohne meldende Person · Zeilen gelöschter Gedanken nach 30 Tagen ganz weg · Audit-Log der Moderation 24 Monate (der Datenbank-Trigger erlaubt nur dieses Löschen) · Lösch-Journal 60 Tage · IP-Hashes und Rate-Limits 24 Stunden.

### «Zuhören, wenn es still bleibt» (Job `nudge-listeners`, alle 30 Minuten)

Wer das in den Einstellungen einschaltet, bekommt in der Glocke (nie als Push, nie mit dem Text) einen Hinweis auf einen Gedanken, der seit 6 Stunden ohne Antwort ist. Pro Gedanke höchstens drei Personen und nur einmal, pro Person höchstens ein Hinweis am Tag. Blockierungen in beide Richtungen, ausgeblendete Gedanken und stummgeschaltete Kreise werden beachtet.

### Moderationszeiten

Ohne Nachtbereitschaft ist das Team von 22 bis 7 Uhr (Schweizer Zeit) nicht erreichbar. In dieser Zeit gibt es keine Krisen-Pushes an das Team, die Glocke bekommt den Hinweis trotzdem. Um 7 Uhr meldet der Monitor alles, was noch wartet. Für die Betroffenen sagen «Sofort Hilfe» und der Krisen-Hinweis ehrlich, dass gerade niemand online ist, und verweisen auf 143 und 144. Gibt es eine Bereitschaft: `NIGHT_MODERATION=1` an web, worker und monitor setzen (`lib/moderation-hours.ts`).

### Transparenz

`/transparenz` zeigt öffentlich Zahlen der letzten zwei abgeschlossenen Quartale (Austausch, Meldungen, Massnahmen, Einsprüche, Median bei akuten Krisenhinweisen). Werte von 1 bis 9 erscheinen nur als «weniger als 10». Die Seite ist vorgerendert und wird stündlich neu berechnet.

### CI

`.github/workflows/ci.yml` prüft jeden Pull Request: Typen, Unit-Tests, Build ohne Datenbank (wie auf Railway), `npm audit` (hoch/kritisch) und die ganze E2E-Suite gegen Postgres 16. Dependabot schlägt wöchentlich gesammelte Updates vor.

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

### Schnittstelle für die Apps (`/api/v1`)

Die iOS-App (Repository `mental-ios`) spricht mit denselben Server Actions wie die Web-App: `POST /api/v1/<name>` mit `{ "args": [...] }` ruft die gleichnamige Action auf – mit denselben Prüfungen, Grenzen, Texten und Benachrichtigungen. Erlaubt sind nur die Aufrufe in der Liste in `app/api/v1/[name]/route.ts`; dazu kommen lesende Abfragen aus `lib/server/mobile.ts` (`me`, `feed`, `post`, `history` …), die im Web in Server Components stecken.

- **Sitzung:** `Authorization: Bearer <token>`. Nach `login`, `register` und `recover` steht das neue Token in der Antwort (`{ result, token }`). Es ist dieselbe Tabelle `sessions` wie im Web – die App erscheint unter «Aktive Sitzungen» als «iPhone · App» und lässt sich dort beenden.
- **Kein CSRF:** Auf `/api/v1` zählen Cookies nie, und es werden nur Anfragen mit `Content-Type: application/json` angenommen (`lib/server/api-context.ts`).
- **Bilder** laden wie im Web über `/api/uploads` (signierte PUT-URL) und `/api/media/<id>`; beide akzeptieren das Bearer-Token.
- **Tagebuch:** gleiches Format wie `lib/client/journal-crypto.ts` – Einträge sind in Web und App lesbar, der Server sieht nur Chiffretext.

### Bewusste Entscheidungen

- **Eigene Sitzungen statt Better Auth.** Better Auth verlangt in seinem Kernschema eine E-Mail-Adresse. Die PRD verbietet genau das. Sitzungen, Argon2id, Rate-Limits und Passkeys sind deshalb direkt umgesetzt, nach dem Datenmodell der PRD.
- **Strikte CSP mit Nonce** auf allen Seiten mit Sitzung oder Nutzerinhalten. Diese Seiten werden pro Request gerendert, weil vorgerendertes HTML keine Nonce tragen kann. Die rein statischen Seiten (Landing, Hilfe, Regeln, Datenschutz, Offline) erlauben die von Next.js eingebetteten Inline-Skripte; sie enthalten keine Nutzerinhalte.
- **HEIC** wandelt der Browser vor dem Upload in JPEG um. Der vorgebaute sharp-Build kann HEVC nicht dekodieren, und so erreichen den Worker nur Formate, die er sicher neu kodieren kann.
- **Bilder:** Upload direkt in den Bucket (`quarantine/<id>`). Der Worker prüft das Format, entfernt EXIF/GPS und kodiert neu (WebP + AVIF). Danach wartet das Bild in `/admin/bilder`, bis die Moderation (Rolle `mod` oder `admin`) es freigibt oder ablehnt. Hängt ein Bild noch in der Quarantäne, bereinigt die Freigabe es direkt im Web-Service. Bis dahin sieht nur die Verfasserin «Bild wird geprüft …», alle anderen sehen kein Bild.
- **Moderation, Stufe 2:** läuft immer lokal (Wortliste + Heuristik) und fragt zusätzlich einen Anbieter, sobald `MODERATION_API_URL` gesetzt ist. Welcher Anbieter das wird, ist eine offene Frage der PRD.
- **Fehler-Monitoring:** `instrumentation.ts` protokolliert nur Route und Digest, keine Inhalte. Sentry (EU-Region) ist noch nicht angebunden.

## Offene Punkte aus der PRD

Moderations-Anbieter (EU/CH, versteht Mundart), Besetzung des Moderationsteams 06–24 Uhr, fachliche Abnahme der Krisenlogik und Wortliste, rechtliche Prüfung (nDSG), externer Pentest, Mindestalter 16 oder 18, Finanzierung. Version 1.1: weitere Atemmuster, Peer-Moderation (Rollen und Rechte sind schon angelegt).

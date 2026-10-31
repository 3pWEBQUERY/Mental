# Mehrsprachigkeit (Deutsch / Französisch)

## So funktioniert es

- **Wahl der Sprache**
  - Das Cookie `lichtung_lang` (`de` | `fr`) gilt für das Gerät. Bei Angemeldeten steht die Sprache zusätzlich im Konto (`settings.locale`).
  - **Erster Besuch:** `proxy.ts` übernimmt die Sprache aus `Accept-Language` (`pickLocale`), Französisch nur, wenn es vor Deutsch steht.
  - **Wechseln:** Einstellungen → Darstellung → Sprache, oder «En français» / «Auf Deutsch» im Footer. Beides führt über `/sprache?l=…&zurueck=…`: Cookie setzen, Konto merken, zurück zur Seite.
  - **Anmelden:** Die Sprache des Kontos gilt auf dem neuen Gerät (`syncLocale` in `lib/server/session.ts`). Hat das Konto noch keine, übernimmt es die des Geräts (z. B. bei der Registrierung).
- **Texte**
  - Alle Texte liegen in `messages/de.ts` und `messages/fr.ts`. TypeScript prüft, dass beide dieselbe Struktur haben.
  - `m` (`messages/index.ts`) ist ein Proxy und liefert bei jedem Zugriff die aktuelle Sprache:
    - **Browser:** aus dem Cookie. Ein Wechsel lädt die Seite neu.
    - **Server:** pro Anfrage aus dem Cookie (`lib/server/request-locale.ts`, beim Start über `instrumentation.ts` registriert). Das liest den Anfrage-Speicher von Next, also intern. `tests/e2e/i18n.spec.ts` prüft nach jedem Upgrade, dass Französisch ankommt.
    - **Ohne Anfrage** (Build, `'use cache'`, Worker): Deutsch.
  - **Regel:** `m` nie in Konstanten auf Modulebene lesen. Für Abkürzungen gibt es `lazy('bereich')`, Seitentitel kommen aus `generateMetadata`.
- **Texte an andere Personen**
  - Gemeint sind Moderation, Sicherheitshinweise, Zuhören, Krisen-Alarm und Push.
  - Sie kommen in der Sprache der **empfangenden** Person an. Dafür nehmen `notifySystem`, `notifyModeration` und `notifyAdmins` eine Funktion `(t) => t.…` entgegen (`lib/recipient-locale.ts`).
- **Inhalte aus der Datenbank**
  - Kreise und kleine Schritte haben eine Spalte `i18n.fr`. Fehlt dort eine Übersetzung, gilt der deutsche Text.
  - Hilfe-Nummern und Krisenbegriffe haben die Spalte `language`.
  - Gepflegt wird alles im Admin-Bereich. Der Seed ergänzt die französischen Standardtexte einmalig.
  - Krisenbegriffe aller Sprachen gelten immer, egal welche Sprache die Oberfläche hat.

## Bewusst (noch) nur Deutsch

- **Vorgerenderte Seiten:** `/hilfe`, `/offline` und die Fehlerseiten müssen auch ohne Datenbank und offline funktionieren. Die französische Hilfe ist `/aide`, ebenfalls vorgerendert. «Sofort Hilfe» in der App ist zweisprachig.
- **Rechtstexte** (`/datenschutz`, `/impressum`): Ein Hinweis auf Französisch steht oben auf der Seite. Die Übersetzung folgt nach rechtlicher Prüfung.
- **Moderationsbereich:** Ein Teil der Beschriftungen ist dort fest auf Deutsch.
- **Gespeicherte Benachrichtigungen** bleiben in der Sprache, die beim Erstellen galt.
- **Datenexport** und PWA-Manifest.

## Vor dem öffentlichen Einsatz

Die sicherheitskritischen Texte von einer Fachperson aus der Romandie prüfen lassen, siehe `fr-pruefung.md`.

Italienisch folgt demselben Weg: `it.ts`, `LOCALES` erweitern, `i18n.it` in Kreisen und Schritten, `language = 'it'` für Hilfe und Begriffe.

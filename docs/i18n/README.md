# Mehrsprachigkeit (Deutsch / Französisch / Italienisch)

## So funktioniert es

- **Wahl der Sprache**
  - Das Cookie `lichtung_lang` (`de` | `fr` | `it`) gilt für das Gerät. Bei Angemeldeten steht die Sprache zusätzlich im Konto (`settings.locale`).
  - **Erster Besuch:** `proxy.ts` übernimmt die erste unterstützte Sprache aus `Accept-Language` (`pickLocale`), sonst Deutsch.
  - **Wechseln:** Umschalter **DE · FR · IT** im Kopf jeder öffentlichen Seite, in der App unter Einstellungen → Darstellung → Sprache. Beides führt über `/sprache?l=…&zurueck=…`: Cookie setzen, Konto merken, zurück zur Seite (bei den Hilfeseiten auf die der neuen Sprache).
  - **Anmelden:** Die Sprache des Kontos gilt auf dem neuen Gerät (`syncLocale` in `lib/server/session.ts`). Hat das Konto noch keine, übernimmt es die des Geräts (z. B. bei der Registrierung).
- **Texte**
  - Alle Texte liegen in `messages/de.ts`, `messages/fr.ts` und `messages/it.ts`. TypeScript prüft, dass alle dieselbe Struktur haben.
  - `m` (`messages/index.ts`) ist ein Proxy und liefert bei jedem Zugriff die aktuelle Sprache:
    - **Browser:** aus dem Cookie. Ein Wechsel lädt die Seite neu.
    - **Server:** pro Anfrage aus dem Cookie (`lib/server/request-locale.ts`, beim Start über `instrumentation.ts` registriert). Das liest den Anfrage-Speicher von Next, also intern. `tests/e2e/i18n.spec.ts` prüft nach jedem Upgrade, dass Französisch ankommt.
    - **Ohne Anfrage** (Build, `'use cache'`, Worker): Deutsch.
  - **Regel:** `m` nie in Konstanten auf Modulebene lesen. Für Abkürzungen gibt es `lazy('bereich')`, Seitentitel kommen aus `generateMetadata`.
- **Texte an andere Personen**
  - Gemeint sind Moderation, Sicherheitshinweise, Zuhören, Krisen-Alarm und Push.
  - Sie kommen in der Sprache der **empfangenden** Person an. Dafür nehmen `notifySystem`, `notifyModeration` und `notifyAdmins` eine Funktion `(t) => t.…` entgegen (`lib/recipient-locale.ts`).
- **Inhalte aus der Datenbank**
  - Kreise und kleine Schritte haben eine Spalte `i18n` (`fr`, `it`). Fehlt dort eine Übersetzung, gilt der deutsche Text.
  - Hilfe-Nummern und Krisenbegriffe haben die Spalte `language`.
  - Gepflegt wird alles im Admin-Bereich. Der Seed ergänzt die französischen Standardtexte einmalig.
  - Krisenbegriffe aller Sprachen gelten immer, egal welche Sprache die Oberfläche hat.

## Bewusst (noch) nur Deutsch

- **Vorgerenderte Seiten:** `/hilfe`, `/offline` und die Fehlerseiten müssen auch ohne Datenbank und offline funktionieren. Die französische Hilfe ist `/aide`, die italienische `/aiuto`, beide ebenfalls vorgerendert. «Sofort Hilfe» in der App folgt der gewählten Sprache.
- **Rechtstexte** (`/datenschutz`, `/impressum`): Ein Hinweis auf Französisch und Italienisch steht oben auf der Seite. Die Übersetzung folgt nach rechtlicher Prüfung.
- **Moderationsbereich:** Ein Teil der Beschriftungen ist dort fest auf Deutsch.
- **Gespeicherte Benachrichtigungen** bleiben in der Sprache, die beim Erstellen galt.
- **Datenexport** und PWA-Manifest.

## Vor dem öffentlichen Einsatz

Die sicherheitskritischen Texte von Fachpersonen aus der Romandie bzw. dem Tessin prüfen lassen, siehe `fr-pruefung.md` und `it-pruefung.md`.

Eine weitere Sprache (z. B. Rätoromanisch) folgt demselben Weg: `xx.ts`, `LOCALES`/`LOCALE_TAG` erweitern, `pickLocale`, Umschalter (`components/lang-switch.tsx`), `i18n.xx` in Kreisen und Schritten, `language = 'xx'` für Hilfe und Begriffe, eigene vorgerenderte Hilfeseite.

# Mehrsprachigkeit – Stand und nächster Schritt

## Stand

- Alle Texte liegen in `messages/de.ts`. `messages/fr.ts` enthält die vollständige französische Fassung, mit derselben Struktur. TypeScript prüft das (`Messages`): Fehlt ein Text oder hat eine Funktion andere Parameter, bricht der Build ab.
- **Live ist nur Deutsch.** Französisch wird erst eingeschaltet, wenn die sicherheitskritischen Texte von Menschen geprüft sind (siehe `fr-pruefung.md`).

## Nächster Schritt: Umschalten (eigener PR, nach der Prüfung)

Entscheid: **Sprache im Pfad** (`/fr/...`). Deutsch bleibt ohne Präfix, damit bestehende Links und Lesezeichen gelten.

1. **Routen:** `app/[lang]/…` mit `generateStaticParams` → `['de', 'fr']`.
   - Lesen über `next/root-params` (`lang()`) in Server Components, ohne die Sprache durch alle Komponenten durchreichen zu müssen.
   - `proxy.ts` schreibt Pfade ohne Präfix intern auf `/de/…` um und wählt beim ersten Besuch anhand von `Accept-Language` vor.
2. **Texte:**
   - Server: `getMessages(await lang())` statt des globalen `m`.
   - Client: Die Wörterbücher kommen per `MessagesProvider` aus dem Layout, mit `useMessages()` statt `m`. Das betrifft etwa 75 Dateien, die Umstellung ist mechanisch.
3. **Server Actions und Worker:** `next/root-params` gibt es dort nicht. Die Sprache steht deshalb im Profil (`settings.locale`).
   - Benachrichtigungen, Push-Texte und die Fürsorge-Nachricht der Moderation verwenden die Sprache der *empfangenden* Person.
   - Gespeicherte Benachrichtigungen bekommen einen Schlüssel statt eines fertigen Texts, wo das heute noch nicht so ist.
4. **Daten aus der Datenbank:** Hilfe-Nummern, Kreise, Hausregeln und Krisenbegriffe bekommen je Sprache eine Spalte oder Zeile.
   - Krisenbegriffe auf Französisch braucht es zwingend, sonst greift die Krisenerkennung für französische Texte nicht.
5. **Tests:** E2E einmal pro Sprache für die Krisenpfade (Hinweis beim Tippen, Vollbild, Sofort Hilfe, Offline-Seite).

Italienisch folgt demselben Weg mit einer `it.ts`.

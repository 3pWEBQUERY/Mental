# Verzeichnis der Bearbeitungstätigkeiten (Art. 12 DSG) – ENTWURF

> Aus dem Code abgeleitet (Stand dieses Commits). **Kein Rechtsrat.** Vor dem Launch von einer Fachperson für
> Datenschutz prüfen und ergänzen lassen. Offene Punkte stehen am Ende.

**Verantwortlich:** Alexander Sulschani, Schaffhauserstrasse 6, 8180 Bülach · kontakt@lichtung.ch

**Zweck des Angebots:** anonymer Peer-Support (Gedanken teilen, Zuspruch, Antworten), Selbsthilfe-Werkzeuge
(Atmen, 5-4-3-2-1, Check-in, Tagebuch, Notfallplan, Briefe), Moderation und Krisenhinweise.

| Bearbeitung | Daten | Betroffene | Zweck | Rechtsgrundlage / Hinweis | Aufbewahrung | Empfänger |
| --- | --- | --- | --- | --- | --- | --- |
| Konto | Benutzername, Passwort-Hash (Argon2id), Schlüssel-Hash, Bestätigung 16+ und Hausregeln (Zeitpunkt), Rolle, Status | Mitglieder | Anmeldung, Missbrauchsschutz | Vertrag / Einwilligung | bis Löschung (7 Tage Frist) bzw. 24 Monate Inaktivität | Railway (Hosting) |
| Gedanken, Antworten, Zuspruch | Text, Stimmung, Bedürfnis, Kreis, Bild (bereinigt), Bildbeschreibung | Mitglieder | Kern des Angebots | Einwilligung (besonders schützenswert: Gesundheit) | bis zur Löschung; «loslassen» automatisch; Zeile nach 30 Tagen | Railway; Moderations-Anbieter (nur Text, falls aktiv) |
| Check-in, Notizen | Stimmung, Notiz (verschlüsselt, wenn Schlüssel gesetzt) | Mitglieder | Verlauf für die Person | Einwilligung | bis Löschung des Kontos | Railway |
| Notfallplan, Briefe | Freitext (verschlüsselt, wenn Schlüssel gesetzt) | Mitglieder | Selbsthilfe | Einwilligung | bis Löschung | Railway |
| Tagebuch | nur Chiffrat (Schlüssel bei der Person) | Mitglieder | Selbsthilfe | Einwilligung | bis Löschung | Railway |
| Krisenerkennung | Treffer-Stufe am Inhalt | Mitglieder | Schutz in akuter Gefahr | überwiegendes Interesse / lebenswichtiges Interesse – **prüfen** | wie der Inhalt | Moderation (intern) |
| Meldungen, Einsprüche | Grund, Notiz, meldende Person | Mitglieder | Moderation | berechtigtes Interesse | Notiz und Person 12 Monate nach Erledigung | Moderation (intern) |
| Moderations-Protokoll | Aktion, Begründung, Mitglieds-ID | Mitglieder, Moderierende | Nachvollziehbarkeit | berechtigtes Interesse | 24 Monate | intern |
| Benachrichtigungen, Push | Art, Auszug, Push-Endpunkt | Mitglieder | Information | Einwilligung (Push) | 30 Tage; Push-Abo bis Widerruf | Push-Dienst des Browsers (Google, Apple, Mozilla, Microsoft) |
| Sitzungen, Passkeys | Gerätetyp, Zeitpunkte, öffentlicher Schlüssel | Mitglieder | Anmeldung | Vertrag | Ablauf der Sitzung bzw. bis Entfernen | Railway |
| Missbrauchsschutz | IP gesalzen gehasht (IPv6: /64), Zähler | alle Besuchenden | Rate-Limits | berechtigtes Interesse | 24 Stunden | Railway |
| Passwort-Prüfung | 5 Zeichen eines SHA-1-Hashes | Mitglieder | keine bekannten Passwörter | berechtigtes Interesse | nicht gespeichert | Have I Been Pwned (Cloudflare) |
| Backups | alle Daten der Datenbank | alle | Wiederherstellung | berechtigtes Interesse | ≤ 30 Tage; Lösch-Journal 60 Tage | Railway |

**Technische und organisatorische Massnahmen (Auszug):** Verschlüsselung in Transit (TLS) und für Gesundheitsfreitexte
at rest (AES-256-GCM, Schlüssel getrennt), Tagebuch Ende-zu-Ende, Passkey-Pflicht für die Moderation, Mitglieds-IDs
statt Benutzernamen in der Moderation, unveränderliches Audit-Log, Rate-Limits, CSP, keine Drittanbieter-Skripte,
Datenexport und Löschung durch die Person selbst, Lösch-Journal gegen Wiederauferstehung nach Restore.

## Offene Punkte (brauchen eine Entscheidung oder Fachperson)

1. **Datenschutz-Folgenabschätzung (Art. 22 DSG):** wegen umfangreicher Bearbeitung besonders schützenswerter Daten
   voraussichtlich nötig.
2. **Auftragsverarbeitungsverträge:** Railway (DPA des Anbieters), Moderations-Anbieter (noch offen). Bekanntgabe ins
   Ausland: Railway ist ein US-Unternehmen (Rechenzentrum EU) – Garantien prüfen (z. B. Swiss-U.S. DPF, Klauseln).
3. **Nutzungsbedingungen:** Bisher nur Hausregeln, Impressum, Datenschutz.
4. **Altersgrenze:** 16 oder 18? Heute Selbstbestätigung 16+.
5. **Medizinprodukt-Abgrenzung (MepV/MDR):** Krisenerkennung und der Hinweis nach drei Tagen «Schwer» dürfen nicht als
   Diagnose/Screening verstanden werden – schriftliche Zweckbestimmung, Texte prüfen lassen.
6. **Krisen-Wortliste:** fachliche Abnahme und Versionierung durch einen Fachbeirat.
7. **Backups:** Aufbewahrung in Railway auf höchstens 30 Tage stellen (so steht es in der Datenschutzerklärung).

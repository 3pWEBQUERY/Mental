# Hilfe je Kreis – vor dem öffentlichen Einsatz prüfen

Seit November 2026 kann jeder Hilfe-Eintrag einem Kreis zugeordnet sein (Admin → Hilfe, Feld «Kreis»). Solche Einträge erscheinen:

- im Feed, wenn ein Kreis gewählt ist («Hilfe zu diesem Thema»),
- auf `/hilfe`, `/aide` und `/aiuto` unter «Nach Thema»,
- in der iOS-App bei jedem Kreis (`circles[].help`).

Allgemeine Einträge (ohne Kreis) bleiben wie bisher überall sichtbar.

Der Seed legt die Liste unten **einmal** an (`db/seed-kreise.ts`, Schlüssel `kreise-2026-11` in `seed_marks`). Danach pflegt das Admin-Team sie, und ein Deploy legt gelöschte Einträge nicht wieder an.

## Zu prüfen

Bitte für jede Stelle prüfen, ob es sie gibt und ob Name, Link, Zeiten und Zielgruppe stimmen. Stellen ohne Nummer sind bewusst nur verlinkt. Eine Nummer kommt erst dazu, wenn sie bestätigt ist.

| Kreis | Sprache | Stelle | Nummer / Link |
|---|---|---|---|
| Depression | de | Equilibrium | depressionen.ch |
| Angst | de | Angst- und Panikhilfe Schweiz (APhS) | aphs.ch |
| Selbstliebe | de | Arbeitsgemeinschaft Ess-Störungen (AES) | aes.ch |
| Beziehungen & Familie | de / fr / it | Opferhilfe Schweiz | opferhilfe-schweiz.ch / aide-aux-victimes.ch / aiuto-alle-vittime.ch |
| Angehörige | de | Pro Mente Sana | promentesana.ch |
| Angehörige | de | VASK Schweiz | vask.ch |
| Queer & Identität | de | du-bist-du | du-bist-du.ch |
| Queer & Identität | de | Transgender Network Switzerland | tgns.ch |
| Queer & Identität | fr | Fondation Agnodice | agnodice.ch |
| Queer & Identität | it | Imbarco Immediato | imbarcoimmediato.ch |
| mehrere | alle | Die Dargebotene Hand / La Main Tendue / Telefono Amico | 143 |
| mehrere | alle | Pro Juventute | 147 |

## Lücken

- **Französisch und Italienisch:** Für Depression, Angst, Selbstliebe und Angehörige gibt es nur 143/147. Wenn möglich, Fachstellen aus der Romandie und dem Tessin ergänzen (z. B. Pro Mente Sana Romandie, Angehörigenstellen in der Romandie und im Tessin).
- **Opferhilfe-Nummer:** Ob und seit wann eine landesweite Kurznummer der Opferhilfe gilt, ist zu prüfen. Erst dann eintragen.
- **Schlaf:** Hier steht nur 143. Eine Fachstelle für Schlafprobleme ergänzen, falls es eine passende gibt.

## Inhaltshinweis je Kreis

- «Inhaltshinweis immer an» (Admin → Kreise) verschwimmt jeden Gedanken im Kreis, auch ältere, bis man ihn antippt.
- Im Gedanken-Fenster ist der Schalter dann fest an.
- Voreingestellt bei **Angehörige** und **Trauer**. Trauer wird einmalig per Seed eingeschaltet (`trauer-cw-2026-11`).
- Für **Beziehungen & Familie** lohnt sich die Entscheidung im Team.

# Französisch (fr.ts): Prüfliste vor dem Livegang

`messages/fr.ts` ist eine vollständige Übersetzung von `messages/de.ts` (Schweizer Französisch, «tu»). Sie typecheckt und hat dieselbe Struktur. Fachlich geprüft ist sie noch nicht.

Die folgenden Schlüssel sind **sicherheitskritisch**. Bevor Französisch live geht, muss sie ein Mensch freigeben, idealerweise jemand von La Main Tendue (143) oder eine Fachperson für psychische Gesundheit aus der Romandie. Die übrigen Texte (Einstellungen, Tagebuch-Bedienung, Admin) reicht es, sprachlich gegenzulesen.

Schreibweise der Pfade: `a.b[2]` ist das dritte Element eines Arrays, `a.*` steht für alle Schlüssel darunter.

---

## 1. Krisenhinweise und Akut-Dialog

**Prüfen:** Ist der Ton warm und ruhig, nicht klinisch? Ist die Aufforderung, jetzt einen Menschen anzurufen, unmissverständlich? Sind 143 und 144 korrekt zugeordnet? Ist nichts abgeschwächt?

- `care.text`, `care.youth`, `care.acuteDanger`, `care.allDay`, `care.canShare`
- `acute.titleLead`, `acute.titleEm`, `acute.body`, `acute.note`, `acute.stay`, `acute.pending`
- `night.acute`, `night.help`
- `feed.concernCard`
- `moods.needSomeone`, `moods.notes[0]`
- `stage.proHint.title`, `stage.proHint.body`, `stage.proHint.ok`, `stage.proHint.help`
- `errors.errorBody`
- `offline.body`, `offline.plan`

**Ausserhalb von fr.ts:** Diese Hinweise erscheinen nur, wenn die Krisenerkennung anschlägt. Ohne französische Krisenbegriffe (Admin → Krisen-Wortliste) bleibt sie bei französischen Texten stumm. Die Begriffsliste sollte deshalb von derselben Fachperson mitgeprüft werden (siehe `README.md`, Punkt 4).

## 2. Hilfe-Seite und Telefon-Skript

**Prüfen:** Würde La Main Tendue die drei Einstiegssätze so empfehlen? Stimmen die Aussagen zu Anonymität, Kosten und Erreichbarkeit für 143, 147 und 144? Ist die ehrliche Aussage «keine Ortung, keine Meldung an Behörden» klar?

- `help.title`, `help.eyebrow`, `help.intro`, `help.chat`
- `help.pageTitle`, `help.pageTitleLead`, `help.pageTitleEm`, `help.pageIntro`, `help.honest`
- `help.phone.title`, `help.phone.lead`, `help.phone.lines[0]`, `help.phone.lines[1]`, `help.phone.lines[2]`, `help.phone.after`
- `help.alsoTitle`, `help.also[0]`, `help.also[1]`, `help.also[2]`
- `nav.help`
- `landing.principles[4]`
- `onboarding.cards[2].title`, `onboarding.cards[2].body`
- `report.reasons.worry`, `report.worryTitle`, `report.worryTips[0]`, `report.worryTips[1]`, `report.worryTips[2]`
- `register.welcome[1].body` (verweist auf «Aide immédiate»)

**Ausserhalb von fr.ts, aber für die Hilfe-Seite nötig:** Die Angebote selbst kommen aus `lib/help.ts`, und dort steht alles auf Deutsch («Die Dargebotene Hand», «rund um die Uhr», «für Kinder & Jugendliche», «bei akuter Gefahr», «Notruf»). Auch die im Admin gepflegten Hilfe-Nummern sind nur auf Deutsch. Solange das so bleibt, ist die französische Hilfe-Seite gemischtsprachig. Vor dem Livegang lokalisieren: 143 «La Main Tendue», 147 «Pro Juventute», 144 «Urgences» / «Appel d’urgence».

## 3. Notfallplan (`plan`)

**Prüfen:** Folgt der Plan den in der Romandie üblichen Begriffen für Krisen- und Sicherheitspläne? Ist besonders `safe` (Umgebung sicherer machen) behutsam und klar formuliert? Ist der Hinweis zur Offline-Kopie auf geteilten Geräten verständlich?

- `plan.title`, `plan.intro`, `plan.empty`, `plan.create`, `plan.edit`, `plan.save`, `plan.saved`, `plan.open`, `plan.print`
- `plan.printNote` (Nummern und Namen der Dienste)
- `plan.offline`, `plan.offlineHint`, `plan.offlineOn`, `plan.offlineOff`
- `plan.fields.signs.label`, `plan.fields.signs.hint`
- `plan.fields.self.label`, `plan.fields.self.hint`
- `plan.fields.distract.label`, `plan.fields.distract.hint`
- `plan.fields.people.label`, `plan.fields.people.hint`
- `plan.fields.pros.label`, `plan.fields.pros.hint`
- `plan.fields.safe.label`, `plan.fields.safe.hint`

## 4. Erdungsübung 5-4-3-2-1 (`grounding`) und Atmen

**Prüfen:** Entsprechen die Sinnesanweisungen der in der Romandie üblichen Fassung der Übung? «Sentir» heisst sowohl «spüren» als auch «riechen». Darum steht bei Schritt 4 «ressentir» und bei Schritt 2 «sentir l’odeur». Bitte bestätigen.

- `grounding.title`, `grounding.open`, `grounding.intro`
- `grounding.steps[0].text`, `grounding.steps[0].hint` (5, sehen)
- `grounding.steps[1].text`, `grounding.steps[1].hint` (4, spüren)
- `grounding.steps[2].text`, `grounding.steps[2].hint` (3, hören)
- `grounding.steps[3].text`, `grounding.steps[3].hint` (2, riechen)
- `grounding.steps[4].text`, `grounding.steps[4].hint` (1, schmecken)
- `grounding.next`, `grounding.progress`, `grounding.done`, `grounding.doneLead`, `grounding.doneNote`, `grounding.close`, `grounding.back`
- `stage.modes.ground`, `stage.inhale`, `stage.hold`, `stage.exhale`, `stage.breathDone`

## 5. Schnell ausblenden und Diskret-Modus

**Prüfen:** Ist die Bedienung (dreimal Esc) eindeutig? Ist klar, dass die Sitzung im Tab endet? Ziel-URL siehe unten.

- `nav.panic`, `settings.panic`, `settings.panicHint`
- `settings.discreet`, `settings.discreetHint`, `settings.discreetTitle`, `me.notes`
- `onboarding.cards[2].body` (nennt dreimal Esc)
- `plan.offlineHint` (Offline-Kopie wird beim Ausblenden gelöscht)
- `panic.target`: Die URL ist **unverändert** (`https://www.meteoschweiz.admin.ch/`, deutsche Seite). Zu entscheiden ist, ob französischsprachige Personen auf `https://www.meteosuisse.admin.ch/` landen sollen, damit der Wechsel unauffällig wirkt.

## 6. Mitteilungen der Moderation an Nutzer:innen

**Prüfen:** Klingen die Mitteilungen ruhig und respektvoll, nicht strafend? Ist die Fürsorge-Nachricht (`admin.notify.care`) wörtlich so vertretbar? Sind «sourdine» (stummgeschaltet), «suspendu» (gesperrt) und «recours» (Einspruch) für Betroffene verständlich?

- `admin.notify.care`, `admin.notify.hide`, `admin.notify.warn`, `admin.notify.mute24`, `admin.notify.mute7`
- `admin.templates[0]` bis `admin.templates[4]` (Begründungsvorlagen; `[4]` betrifft Selbstverletzung)
- `admin.actions.care`, `admin.reason`
- `admin.account.unmuted`, `admin.account.unbanned`
- `admin.images.approvedNote`, `admin.images.rejectedNote`
- `appeal.open`, `appeal.label`, `appeal.placeholder`, `appeal.send`, `appeal.sent`, `appeal.tooShort`, `appeal.alreadyOpen`, `appeal.accepted`, `appeal.rejected`
- `common.muted`, `auth.banned`
- `feed.pendingMine`, `feed.hiddenMine`, `feed.hiddenReason`
- `replies.pending`, `replies.noAdvice`, `replies.advice`, `replies.derogation`
- `composer.limit`
- `security.passkeyAdded`, `security.recovered` (Sicherheitsmitteilungen an Nutzer:innen)

## 7. Hausregeln (`rules`)

**Prüfen:** Ist die Regel zu Selbstverletzung (`rules.items[4]`) korrekt und nicht verharmlosend? Passen die zitierten Beispiele (`rules.items[3]`) kulturell? Stimmen die Verweise auf die Bedürfnis-Labels («Écoute», «Juste vider mon sac») und den Meldegrund («Je m’inquiète pour cette personne») mit den Labels in der App überein?

- `rules.title`, `rules.intro`, `rules.moderation`
- `rules.items[0]` bis `rules.items[5]` (jeweils Titel und Text)
- `register.welcome[2].title`, `register.rules[0]`, `register.rules[1]`, `register.rules[2]`, `register.acceptRules`
- `circles.rules`, `landing.rules`, `common.fine`
- `needs.listen`, `needs.vent` (werden in `rules.items[1]` zitiert)

## 8. Recht, Datenschutz, Alter

**Prüfen:** Rechtlich relevant sind die Altersgrenze (16), die Aussagen zu Löschfristen (7 Tage, 30 Tage), Export (24 Stunden), Verschlüsselung und Anonymität. Wo nötig, mit der französischen Datenschutzerklärung abgleichen (`docs/datenschutz` gibt es bisher nur auf Deutsch).

- `register.ageTitle`, `register.ageTitleEm`, `register.age`, `register.ageHint`
- `register.welcome[0].body`, `register.keyIntro`, `register.usernameIntro`, `register.passwordPwned`
- `auth.usernameHint`, `auth.recoverLost`
- `settings.deleteHint`, `settings.exportHint`, `settings.displayNamePersonal`, `settings.displayNameOfficial`, `settings.displayNameHint`
- `settings.pushHint`, `settings.listenerHint`
- `journal.intro`, `journal.setupHint`, `journal.shareHint`
- `composer.letGoHint`, `composer.imageHint`
- `feed.blockConfirm`, `feed.hideAnonymousConfirm`
- `transparency.intro`, `transparency.method`
- `meta.description`, `landing.principles[0]`, `landing.principles[1]`
- `landing.privacy`, `landing.imprint`

**Ausserhalb von fr.ts:** `lib/display-name.ts` erkennt reservierte Namen («Moderation», «Lichtung-Team» …) wohl nur auf Deutsch. `settings.displayNameOfficial` nennt jetzt aber «Modération» und «Équipe Lichtung». Diese Namen müssen dort ebenfalls gesperrt werden.

---

## Unsichere Übersetzungsentscheide

| Stelle | Entscheid | Offene Frage |
|---|---|---|
| `acute.titleEm` | «Tu n’es pas **seul·e.**» (Point médian) | «Allein» ist im Deutschen geschlechtsneutral, im Französischen nicht. Ist der Point médian in einem Krisendialog gut lesbar, oder lieber umformulieren? Sonst ist der Text überall neutral formuliert, z. B. `replies.suggestions[1]` «Tu n’es pas la seule personne à vivre ça.» |
| `replies.author` | «Auteur·e» | Gleiche Frage zum Point médian. Alternative: «A partagé la pensée». |
| `help.phone.lines[2]` | «Je pense à me faire du mal.» | Das Deutsche («Gedanken, mir etwas anzutun») ist bewusst offen. Ist diese Formulierung für Anrufende bei 143/147 die richtige, auch mit Blick auf Suizidgedanken? |
| `acute.body` | «Les numéros sont gratuits et anonymes.» | Wie im Deutschen. Stimmt «anonyme» auch für 144? |
| `care.text` | «…porter ça **sans aide**…» | Statt «tout seul / seul·e». Bitte bestätigen. |
| Stummschalten | «sourdine» für Kreise **und** für die Moderationsmassnahme | Alternative für die Massnahme: «lecture seule». |
| Sperren (Konto) | «suspendre» / «suspendu» | Damit es nicht mit «Blockieren» = «bloquer» verwechselt wird. «Suspendu» kann nach «vorübergehend» klingen. |
| Einspruch | «recours», «Faire recours» | Schweizer Rechtssprache. Bitte bestätigen. |
| Hausregeln | «Règles de vie» | Alternativen: «Règles de la maison», «Charte». |
| «Einfach raus damit» | «Juste vider mon sac» | Umgangssprachlich. Passt das für alle Altersgruppen? |
| «Kann belastend sein» | «Peut être difficile à lire» | Alternative: «Contenu sensible». |
| «Rund um die Uhr» | «24 h sur 24» | Einheitlich so verwendet. |
| 144 | «Urgences» (in `plan.printNote`) | Oder «Appel d’urgence» / «Ambulance». |
| Hausärztin/Hausarzt | «Ton ou ta médecin de famille», «une ou un médecin de famille» | Ist das in der Romandie üblich? |
| Passkey | «passkey» (m.) unverändert | Alternative: «clé d’accès». Das könnte aber mit «clé de récupération» verwechselt werden. |
| Benutzername | «Identifiant» | Geschlechtsneutral, anders als «nom d’utilisateur». |
| Merken / Merkliste | «Mettre de côté» / «À relire» | |
| Stimmungen | «Lourd, Fatigue, Ça va, Plus léger, Bien» | «Fatigue» ist ein Nomen, damit keine Geschlechtsform nötig ist. |
| Landing-Titel | «Un lieu où *personne ne juge* personne.» | Auf Französisch umgebaut, weil `title`/`titleEm`/`titleEnd` so gerendert werden. |
| Likes / Followers | Anglizismen beibehalten | Alternative: «abonnés» (generisches Maskulinum). |
| Esc-Taste | «Esc» | Auf Schweizer Tastaturen steht «Esc», in Frankreich «Échap». |
| Typografie | Geschütztes Leerzeichen (U+00A0) vor `: ? ! ;` und innerhalb von « » | In der Schweiz entfällt das Leerzeichen vor `? ! ;` oft, oder es wird ein schmales verwendet. Einheitlich entscheiden. |
| `admin.stats.minutes` | Dezimalkomma per `.replace('.', ',')` | Kleine Ergänzung gegenüber de.ts (Anzeige «2,3 h»). |

## Zusätzlich zu prüfen (seit der Hilfeseite /aide)

- **Hilfeseite `/aide` und `DEFAULT_HELP_FR` (`lib/help.ts`, Seed):**
  - Namen der Stellen («La Main Tendue», «Urgences sanitaires»), Zeiten («24 h sur 24», Chat «tous les jours») und Zielgruppen.
  - Stimmt der Chat von La Main Tendue zeitlich so?
- **Französische Krisenbegriffe** (`DEFAULT_CRISIS_TERMS_FR`, `lib/crisis.ts`):
  - Fehlen gängige Wendungen der Romandie, auch Jugendsprache?
  - Ist eine Wendung zu breit (Fehlalarme), etwa «je n'en peux plus» als «Sorge»?
  - Verglichen werden ganze Wörter, Akzente spielen keine Rolle.

# Italienisch (it.ts): Prüfliste vor dem Livegang

`messages/it.ts` ist eine vollständige Übersetzung von `messages/de.ts` (Schweizer Italienisch / Tessin, «tu»). Sie typecheckt und hat dieselbe Struktur (Schlüssel, Reihenfolge, Array-Längen, Funktionsparameter). Fachlich geprüft ist sie noch nicht.

Die folgenden Schlüssel sind **sicherheitskritisch**. Bevor Italienisch live geht, muss sie ein Mensch freigeben, idealerweise jemand von Telefono Amico Ticino e Grigioni italiano (143) oder eine Fachperson für psychische Gesundheit aus dem Tessin. Die übrigen Texte (Einstellungen, Tagebuch-Bedienung, Admin) reicht es, sprachlich gegenzulesen.

Schreibweise der Pfade: `a.b[2]` ist das dritte Element eines Arrays, `a.*` steht für alle Schlüssel darunter.

Allgemeine Entscheide:

- Anrede durchgehend «tu», Ton ruhig und einfach.
- Wo Italienisch ein Adjektiv nach Geschlecht beugen würde («solo/sola», «preoccupato/preoccupata», «bentornato/bentornata»), ist umformuliert. Ausnahmen stehen in der Tabelle unten.
- Typografie: « » ohne Leerzeichen, typografischer Apostroph ’, kein Leerzeichen vor `: ? !`.
- «Rund um die Uhr» heisst überall «24 ore su 24».

---

## 1. Krisenhinweise und Akut-Dialog

**Prüfen:** Ist der Ton warm und ruhig, nicht klinisch? Ist die Aufforderung, jetzt einen Menschen anzurufen, unmissverständlich? Sind 143 (Telefono Amico) und 144 korrekt zugeordnet? Ist nichts abgeschwächt? Funktioniert die Doppelform in `acute.titleEm` in einem Krisendialog?

- `care.text`, `care.youth`, `care.acuteDanger`, `care.allDay`, `care.canShare`
- `acute.titleLead`, `acute.titleEm`, `acute.body`, `acute.note`, `acute.stay`, `acute.pending`
- `night.acute`, `night.help`
- `feed.concernCard`
- `moods.needSomeone`, `moods.notes[0]`
- `stage.proHint.title`, `stage.proHint.body`, `stage.proHint.ok`, `stage.proHint.help`
- `errors.errorBody`
- `offline.body`, `offline.plan`
- `push.acuteTitle`, `push.acuteBody`, `admin.acuteAlert` (Alarm an das Team)

**Ausserhalb von it.ts:** Diese Hinweise erscheinen nur, wenn die Krisenerkennung anschlägt. Es gibt noch keine italienischen Krisenbegriffe (`lib/crisis.ts` kennt nur `DEFAULT_CRISIS_TERMS` und `DEFAULT_CRISIS_TERMS_FR`). Ohne sie bleibt die Erkennung bei italienischen Texten stumm. Die Begriffsliste muss vor dem Livegang angelegt und von derselben Fachperson geprüft werden, auch mit Jugendsprache und Tessiner Wendungen.

## 2. Hilfe-Seite und Telefon-Skript

**Prüfen:** Würde Telefono Amico die drei Einstiegssätze so empfehlen? Stimmen die Aussagen zu Anonymität, Kosten und Erreichbarkeit für 143, 147 und 144? Ist die ehrliche Aussage «keine Ortung, keine Meldung an Behörden» klar? Heisst es im Tessin «Telefono Amico» oder «il Telefono Amico»?

- `help.title`, `help.href` (`/aiuto`), `help.eyebrow`, `help.intro`, `help.chat`
- `help.pageTitle`, `help.pageTitleLead`, `help.pageTitleEm`, `help.pageIntro`, `help.honest`
- `help.phone.title`, `help.phone.lead`, `help.phone.lines[0]`, `help.phone.lines[1]`, `help.phone.lines[2]`, `help.phone.after`
- `help.alsoTitle`, `help.also[0]`, `help.also[1]`, `help.also[2]`
- `nav.help`
- `landing.principles[4]`
- `onboarding.cards[2].title`, `onboarding.cards[2].body`
- `report.reasons.worry`, `report.worryTitle`, `report.worryTips[0]`, `report.worryTips[1]`, `report.worryTips[2]`
- `register.welcome[1].body` (verweist auf «Aiuto immediato»)
- `grounding.done`, `grounding.doneNote` (verweisen auf «Aiuto immediato»)

**Ausserhalb von it.ts, aber für die Hilfe-Seite nötig:**

- `lib/help.ts` hat nur `DEFAULT_HELP` (Deutsch) und `DEFAULT_HELP_FR`. `HelpLanguage` ist `'de' | 'fr'`.
- Für `/aiuto` braucht es eine italienische Fassung, z. B.:
  - 143 «Telefono Amico», «24 ore su 24», «anonimo, per tutte e tutti»
  - 147 «Pro Juventute», «per bambini e giovani»
  - 144 «Emergenza sanitaria», «in caso di pericolo acuto»
- Die im Admin gepflegten Hilfe-Nummern brauchen `language = 'it'`.
- Stimmen die Chat-Zeiten von Telefono Amico Ticino?

## 3. Notfallplan (`plan`)

**Prüfen:** Folgt der Plan den im Tessin üblichen Begriffen für Krisen- und Sicherheitspläne («piano di crisi», «piano di sicurezza»)? Ist besonders `safe` (Umgebung sicherer machen) behutsam und klar formuliert? Ist der Hinweis zur Offline-Kopie auf geteilten Geräten verständlich?

- `plan.title`, `plan.intro`, `plan.empty`, `plan.create`, `plan.edit`, `plan.save`, `plan.saved`, `plan.open`, `plan.print`
- `plan.printNote` (Nummern und Namen der Dienste: «143 Telefono Amico · 147 Pro Juventute · 144 Emergenza sanitaria»)
- `plan.offline`, `plan.offlineHint`, `plan.offlineOn`, `plan.offlineOff`
- `plan.fields.signs.label`, `plan.fields.signs.hint` («precipitando» für «kippt»)
- `plan.fields.self.label`, `plan.fields.self.hint`
- `plan.fields.distract.label`, `plan.fields.distract.hint`
- `plan.fields.people.label`, `plan.fields.people.hint`
- `plan.fields.pros.label`, `plan.fields.pros.hint`
- `plan.fields.safe.label`, `plan.fields.safe.hint`
- `letters.intro` (Brief erscheint bei «Pesante»)

## 4. Erdungsübung 5-4-3-2-1 (`grounding`) und Atmen

**Prüfen:** Entsprechen die Sinnesanweisungen der im Tessin üblichen Fassung der Übung? Das italienische «sentire» heisst spüren, hören, riechen **und** schmecken. Damit die Schritte eindeutig bleiben:

- Schritt 4: «percepire con il corpo»
- Schritt 3: «tre **suoni** che puoi sentire» (statt «Dinge»)
- Schritt 2: «sentire l’odore»
- Schritt 1: «sentire il sapore»

Bitte bestätigen oder die übliche Fassung nennen.

- `grounding.title`, `grounding.open`, `grounding.intro`
- `grounding.steps[0].text`, `grounding.steps[0].hint` (5, sehen)
- `grounding.steps[1].text`, `grounding.steps[1].hint` (4, spüren)
- `grounding.steps[2].text`, `grounding.steps[2].hint` (3, hören)
- `grounding.steps[3].text`, `grounding.steps[3].hint` (2, riechen)
- `grounding.steps[4].text`, `grounding.steps[4].hint` (1, schmecken)
- `grounding.next`, `grounding.progress`, `grounding.done`, `grounding.doneLead`, `grounding.doneNote`, `grounding.close`, `grounding.back`
- `stage.modes.ground`, `stage.inhale` («Inspira»), `stage.hold` («Trattieni»), `stage.exhale` («Espira»), `stage.breathDone`, `stage.breathMeta`

## 5. Schnell ausblenden und Diskret-Modus

**Prüfen:** Ist die Bedienung (dreimal Esc) eindeutig? Ist klar, dass die Sitzung im Tab endet? Ziel-URL siehe unten.

- `nav.panic`, `settings.panic`, `settings.panicHint` («Nascondi subito»)
- `settings.discreet`, `settings.discreetHint`, `settings.discreetTitle`, `me.notes` (Tab heisst «Note»)
- `onboarding.cards[2].body` (nennt dreimal Esc)
- `plan.offlineHint` (Offline-Kopie wird beim Ausblenden gelöscht)
- `panic.target`: Die URL ist **unverändert** (`https://www.meteoschweiz.admin.ch/`, deutsche Seite). Zu entscheiden ist, ob italienischsprachige Personen auf `https://www.meteosvizzera.admin.ch/` landen sollen, damit der Wechsel unauffällig wirkt.

## 6. Mitteilungen der Moderation an Nutzer:innen

**Prüfen:** Klingen die Mitteilungen ruhig und respektvoll, nicht strafend? Ist die Fürsorge-Nachricht (`admin.notify.care`) wörtlich so vertretbar? Sind «silenziato» (stummgeschaltet), «sospeso» (gesperrt) und «ricorso» (Einspruch) für Betroffene verständlich?

- `admin.notify.care`, `admin.notify.hide`, `admin.notify.warn`, `admin.notify.mute24`, `admin.notify.mute7`
- `admin.templates[0]` bis `admin.templates[4]` (Begründungsvorlagen; `[4]` betrifft Selbstverletzung, «autolesionismo»)
- `admin.actions.care`, `admin.reason`
- `admin.account.unmuted`, `admin.account.unbanned`
- `admin.images.approvedNote`, `admin.images.rejectedNote`
- `admin.roles.changedNotice`
- `appeal.open`, `appeal.label`, `appeal.placeholder`, `appeal.send`, `appeal.sent`, `appeal.tooShort`, `appeal.alreadyOpen`, `appeal.accepted`, `appeal.rejected`
- `common.muted`, `auth.banned`
- `feed.pendingMine`, `feed.hiddenMine`, `feed.hiddenReason`
- `replies.pending`, `replies.noAdvice`, `replies.advice`, `replies.derogation`
- `composer.limit`

## 7. Sicherheitsmitteilungen

**Prüfen:** Ist klar, was die Person tun soll, wenn sie den Passkey nicht selbst hinzugefügt hat? Stimmt der Menüpfad «Impostazioni → Sicurezza» mit den Labels in der App überein (`settings.title`, `settings.sections.security`)?

- `security.passkeyAdded`, `security.recovered` (an Nutzer:innen)
- `security.staffPasskeyAdded`, `security.staffRecovered` (an Admins)
- `settings.passwordChanged`, `settings.recoveryHint`, `auth.locked`, `auth.recoverDone`
- `admin.passkeyRequired`

## 8. Hausregeln (`rules`)

**Prüfen:** Ist die Regel zu Selbstverletzung (`rules.items[4]`) korrekt und nicht verharmlosend («autolesionismo»)? Passen die zitierten Beispiele (`rules.items[3]`: «C’è chi sta peggio», «Non fare tante storie») kulturell? Stimmen die Verweise auf die Bedürfnis-Labels («Ascolto», «Solo sfogarmi») und den Meldegrund («Mi preoccupo per questa persona») mit den Labels in der App überein? Ist «Regole di convivenza» als Name passend?

- `rules.title`, `rules.intro`, `rules.moderation`
- `rules.items[0]` bis `rules.items[5]` (jeweils Titel und Text)
- `register.welcome[2].title`, `register.rules[0]`, `register.rules[1]`, `register.rules[2]`, `register.acceptRules`
- `circles.rules`, `landing.rules`, `common.fine`
- `needs.listen`, `needs.vent` (werden in `rules.items[1]` zitiert)
- `report.reasons.worry` (wird in `rules.items[4]` zitiert)

## 9. Recht, Datenschutz, Alter

**Prüfen:** Rechtlich relevant sind:

- die Altersgrenze (16),
- die Löschfristen (7 Tage, 30 Tage),
- der Export (24 Stunden),
- die Aussagen zu Verschlüsselung und Anonymität.

Wo nötig, mit einer italienischen Datenschutzerklärung abgleichen (`/datenschutz` gibt es bisher nur auf Deutsch). Auf «Impressum» und «Protezione dei dati» als Linktexte achten.

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

**Ausserhalb von it.ts:** `settings.displayNameOfficial` nennt «Moderazione», «Admin» und «Team Jiaia». Die Sperrliste in `lib/display-name.ts` (`moderat\w*`, `admin\w*`, `team`, `jiaia` …) deckt diese Namen schon ab. Italienische Varianten wie «staff» und «ufficiale» sollten trotzdem ergänzt werden: «staff» ist schon drin, «ufficiale» fehlt.

## 10. Ebenfalls zu prüfen: Inhalte ausserhalb von it.ts

- **Hilfeseite `/aiuto`** und `DEFAULT_HELP_IT` in `lib/help.ts` sowie im Seed:
  - Telefono Amico 143, Pro Juventute 147, «Emergenza sanitaria» 144 und die Chats.
  - Stimmen Namen, Zeiten («24 ore su 24», Chat «tutti i giorni») und Zielgruppen?
- **Italienische Krisenbegriffe** (`DEFAULT_CRISIS_TERMS_IT` in `lib/crisis.ts`):
  - Fehlen gängige Wendungen aus dem Tessin oder der Jugendsprache?
  - Ist eine Wendung zu breit? «Akut» stellt einen Gedanken bis zur Prüfung zurück.
- **Kreise und kleine Schritte** (Seed, `i18n.it`):
  - Namen, Beschreibungen, Regeln, zum Beispiel «Esaurimento» für Burnout.
- **Reservierte Anzeigenamen** (`lib/display-name.ts`):
  - «Moderazione», «ufficiale» und «squadra» sind jetzt gesperrt.

---

## Unsichere Übersetzungsentscheide

| Stelle | Entscheid | Offene Frage |
|---|---|---|
| `acute.titleLead` + `acute.titleEm` | «Non sei *sola, non sei solo.*» | «Allein» ist im Deutschen geschlechtsneutral, im Italienischen nicht. Die Doppelform ist warm, aber länger. Alternativen: «Non sei solo/a», Schwa («solə»), oder umformulieren («C’è chi ti ascolta.»). Sonst ist der Text überall neutral, z. B. `replies.suggestions[1]` «Non sei l’unica persona a vivere questo.» |
| `care.text` | «Non devi portare tutto questo **senza aiuto**» | Statt «da solo/da sola». Bitte bestätigen. |
| `help.phone.lines[2]` | «Ho pensieri di farmi del male.» | Das Deutsche («Gedanken, mir etwas anzutun») ist bewusst offen. Ist die Formulierung für Anrufende bei 143/147 richtig, auch mit Blick auf Suizidgedanken? Alternative: «Mi vengono pensieri di farmi del male.» |
| `acute.body` | «I numeri sono gratuiti e anonimi.» | Wie im Deutschen. Stimmt «anonimo» auch für 144? |
| Telefono Amico | ohne Artikel: «Telefono Amico risponde al 143» | Im Tessin auch «il Telefono Amico». Einheitlich entscheiden. |
| 144 | «Emergenza sanitaria» (in `plan.printNote`) | Oder «Numero d’emergenza» / «Ambulanza». |
| Hausärztin/Hausarzt | «una medica o un medico di famiglia», «la tua medica o il tuo medico di famiglia» | «Medica» setzt sich durch, ist aber nicht überall üblich. Alternative: «il medico di famiglia» (generisches Maskulinum). |
| `stage.proHint.body` | «…oppure una psicoterapeuta…» | Wie im Deutschen nur die weibliche Form («eine Psychotherapeutin»). |
| Stimmungen | «Pesante, Stanchezza, Okay, Meglio, Bene» | «Stanchezza» (Nomen) und «Meglio» (Adverb) statt «stanco/a» und «più leggero/a», damit keine Geschlechtsform nötig ist. «Leichter» wird so zu «besser». |
| `support.same` | «So com’è» («Ich weiss, wie das ist») | Für «Kenn ich». Alternative: «Anch’io». |
| `support.hear` | «Ti ascolto» | Wörtlich wäre «Ti sento», das klingt aber nach Akustik. |
| `needs.vent` | «Solo sfogarmi» | Umgangssprachlich. Passt das für alle Altersgruppen? |
| Stummschalten | «silenziare» für Kreise **und** für die Massnahme | Bei der Massnahme ist immer das *Konto* stumm («il tuo account è silenziato»), damit kein «silenziato/a» für die Person nötig ist. Alternative: «sola lettura». |
| Sperren (Konto) | «sospendere» / «sospeso» | Damit es nicht mit «Blockieren» = «bloccare» verwechselt wird. «Sospeso» kann nach «vorübergehend» klingen. |
| Einspruch | «ricorso», «Presenta ricorso» | Schweizer Rechtssprache. Bitte bestätigen. Für die Moderation «accogliere» / «respingere». |
| Hausregeln | «Regole di convivenza» | Alternativen: «Regole della casa», «Regole della comunità». |
| «Kann belastend sein» | «Può essere difficile da leggere» | Alternative: «Contenuto delicato». |
| Selbstverletzung | «autolesionismo» (`rules.items[4]`, `admin.templates[4]`) | Fachbegriff, klar. Für Jugendliche eventuell zu technisch. Alternative: «farsi del male». |
| `replies.author` | «Chi l’ha condiviso» | Statt «Autore/Autrice». Bezieht sich auf den Gedanken und ist so neutral. Als Etikett etwas lang. |
| `report.reasons.worry` | «Mi preoccupo per questa persona» | Statt «Sono preoccupato/a». |
| `auth.loginTitleLead` + `auth.loginTitleEm` | «Che bello *rivederti.*» | Statt «Bentornato/a». Auch in `auth.deletionCancelled`. |
| `register.steps[0]` | «Benvenuto» | Als Nomen («il benvenuto») gemeint, kann aber männlich gelesen werden. `onboarding.title` ist deshalb «Ti diamo il benvenuto». |
| `nav.me`, `me.title` | «Io» | Kurz, wie «Ich» und «Moi». Wirkt als Menüpunkt ungewohnt. Alternative: «Il mio spazio». Wird zitiert in `feed.bookmarked` und `plan.empty` («Io → Per me»). |
| Merken / Merkliste | «Metti da parte» / «Da rileggere» | «Salva» ist schon für Speichern vergeben. |
| `letters.placeholder` | «Ciao, sono io. Oggi stavo bene perché …» | «Liebes Ich» wäre «Caro me / Cara me» und damit gegendert. |
| `landing.title…titleEnd` | «Un luogo dove *nessuno giudica* nessuno.» | Umgebaut wie im Französischen, weil `title` / `titleEm` / `titleEnd` hintereinander gerendert werden. |
| `landing.principles[5]` | «Calma invece di dipendenza.» | Für «Ruhig statt süchtig». |
| `plan.fields.signs.label` | «Come mi accorgo che le cose stanno precipitando» | «Precipitare» ist stark. Alternative: «…che sto peggiorando». |
| `plan.fields.self.label` | «Che cosa posso fare io per aiutarmi» | Statt «da solo/a». |
| Passkey | «passkey» (f.), «la passkey», Plural unverändert | So bei Apple und Google auf Italienisch. |
| Benutzername | «nome utente» | Vorgegeben. Grammatisch männlich, bezieht sich aber auf den Namen, nicht auf die Person. |
| Tagebuch-Eintrag | «annotazione» | Alternative: «voce». |
| Verschlüsselung | «cifrare» / «cifratura» | Wie in der Bundesverwaltung. Alternative: «crittografare». |
| Likes / Follower | Anglizismen beibehalten | Im Italienischen üblich, ohne Plural-s. |
| Esc-Taste | «Esc» | Auf Schweizer Tastaturen steht «Esc». |
| `feed.time.*` | «5 min fa», «3 h fa» | Kurzformen. |
| `admin.stats.minutes` | Dezimalkomma per `.replace('.', ',')` | Wie in fr.ts (Anzeige «2,3 h»). |
| Admin-Texte allgemein | «Coda», «Registro di audit», «Scarta», «Ammonisci», «Presente dal» | Bewusst schlicht. «Presente dal» für «Dabei seit», um «iscritto/a» zu vermeiden. |

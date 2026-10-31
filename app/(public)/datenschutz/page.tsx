import type { Metadata } from 'next'
import { PublicShell } from '@/components/ui'
import { atRestEnabled } from '@/lib/at-rest'

export const metadata: Metadata = { title: 'Datenschutz' }

/** Datenschutzerklärung in einfacher Sprache. Vor dem Launch von einer Fachperson zu prüfen (nDSG). */
export default function PrivacyPage() {
  return (
    <PublicShell>
      <div className="prose" style={{ margin: '0 auto' }}>
        <h1 className="display">Datenschutz, einfach erklärt</h1>
        <p>
          Lichtung verarbeitet Gedanken zu Gesundheit und Gefühlen. Nach dem Schweizer Datenschutzgesetz sind das
          besonders schützenswerte Daten. Darum gilt bei uns: Was wir nicht speichern, kann nicht leaken.
        </p>
        <h2>Was wir nicht erheben</h2>
        <ul className="dash">
          <li>Keine E-Mail-Adresse, keine Telefonnummer, keinen Klarnamen, kein Geburtsdatum, keinen Standort.</li>
          <li>Keine Analytics-Tools, keine Werbe-Cookies, kein Fingerprinting.</li>
          <li>Keine Skripte von Dritten. Schriften und Three.js liefern wir selbst aus.</li>
        </ul>
        <h2>Was wir speichern</h2>
        <ul className="dash">
          <li>Deinen Benutzernamen (nur zum Einloggen, nie öffentlich), dein Passwort und deinen Wiederherstellungsschlüssel – beides nur als Argon2id-Hash.</li>
          <li>Dass du mindestens 16 bist und die Hausregeln angenommen hast – als Zeitpunkt, ohne Geburtsdatum.</li>
          <li>Deine Gedanken, Antworten, Check-ins und Einstellungen. Ganz anonyme Gedanken sind intern deinem Konto zugeordnet, damit du sie löschen kannst und die Moderation funktioniert – sie werden aber nie mit einer Konto-ID ausgeliefert.</li>
          <li>Dein Tagebuch nur verschlüsselt. Den Schlüssel hast nur du.</li>
          <li>
            Deinen Notfallplan und deine Briefe an dich selbst, wenn du welche anlegst. Sie sind nur für dich sichtbar, Teil deines Datenexports und werden mit deinem
            Konto gelöscht.
            {atRestEnabled() && ' Sie liegen – wie deine Check-in-Notizen – verschlüsselt in der Datenbank; der Schlüssel liegt getrennt davon.'}
          </li>
          <li>
            Wenn du die Offline-Kopie deines Notfallplans einschaltest, liegt sie zusätzlich im Speicher deines Browsers auf diesem Gerät – bis du dich abmeldest
            oder Lichtung schnell ausblendest.
          </li>
          <li>
            Wenn du «Zuhören, wenn es still bleibt» einschaltest, merken wir uns, wann wir dich zuletzt auf einen wartenden Gedanken hingewiesen haben (höchstens
            einmal am Tag). Wer gefragt wurde, sieht niemand sonst.
          </li>
          <li>Gedanken, die du «loslassen» willst, löschen wir zum gewählten Zeitpunkt endgültig – samt Antworten.</li>
          <li>Sitzungen mit Gerätetyp und Datum, ohne IP-Adresse.</li>
          <li>IP-Adressen nur gesalzen gehasht für den Schutz vor Missbrauch. Nach 24 Stunden werden sie gelöscht.</li>
        </ul>
        <h2>Bilder</h2>
        <p>
          Bevor jemand dein Bild sieht, entfernen wir alle Metadaten (auch GPS und Kameradaten), kodieren es neu und das Moderationsteam gibt es frei. Bilder
          sind nie über eine öffentliche Adresse erreichbar, nur über kurzlebige Links für eingeloggte Mitglieder.
        </p>
        <h2>Wo deine Daten liegen – und wer daran beteiligt ist</h2>
        <ul className="dash">
          <li>
            <b>Hosting, Datenbank und Speicher:</b> Railway Corp. (USA), Rechenzentrum in der Region EU West. Die Daten liegen in Europa; weil der
            Anbieter ein US-Unternehmen ist, ist ein Zugriff aus den USA (etwa auf behördliche Anordnung) nicht ganz auszuschliessen. Darum speichern
            wir so wenig wie möglich und keine Namen, E-Mails oder Telefonnummern.
          </li>
          <li>
            <b>Push-Benachrichtigungen</b> (nur wenn du sie einschaltest): Sie laufen über den Push-Dienst deines Browsers – Google (Chrome, Android),
            Apple (Safari, iPhone), Mozilla (Firefox) oder Microsoft (Edge). Die Nachricht ist neutral («Jemand hat dir geantwortet»), ohne den Text deines
            Gedankens.
          </li>
          <li>
            <b>Passwort-Prüfung:</b> Beim Festlegen eines Passworts prüfen wir, ob es in bekannten Datenlecks vorkommt. Dafür gehen nur die ersten fünf Zeichen
            eines Hash-Werts an «Have I Been Pwned» (über Cloudflare) – nie das Passwort selbst.
          </li>
          <li>
            <b>Automatische Prüfung von Texten</b> (falls eingeschaltet): Es geht nur der Text an den Moderations-Anbieter, nie eine Konto- oder Pseudonym-ID.
          </li>
        </ul>
        <h2>Wie lange wir was aufbewahren</h2>
        <ul className="dash">
          <li>Benachrichtigungen: 30 Tage.</li>
          <li>Gelöschte Gedanken: sofort ohne Text; die leere Zeile verschwindet nach 30 Tagen ganz.</li>
          <li>Meldungen: Nach 12 Monaten entfernen wir Notiz und meldende Person; es bleibt nur die Zahl für die Statistik.</li>
          <li>Protokoll der Moderation (wer hat wann was ausgeblendet): 24 Monate.</li>
          <li>
            Sicherungskopien (Backups): höchstens 30 Tage. Müssen wir einmal eine Sicherung zurückspielen, löschen wir danach erneut alles, was du vorher
            gelöscht hattest – gelöscht bleibt gelöscht.
          </li>
        </ul>
        <h2>Deine Rechte</h2>
        <ul className="dash">
          <li>
            Unter Einstellungen → Daten lädst du jederzeit alle deine Daten als ZIP herunter: Gedanken, Antworten, Check-ins, Notfallplan, Briefe, Tagebuch
            (verschlüsselt), deine Meldungen, Benachrichtigungen, Geräte und Sitzungen sowie Massnahmen der Moderation, die dich betreffen.
          </li>
          <li>Du kannst dein Konto jederzeit löschen. Nach 7 Tagen ist alles endgültig weg, auch Bilder – in Sicherungskopien spätestens nach 30 Tagen.</li>
          <li>Konten, die seit 24 Monaten nicht mehr benutzt wurden, löschen wir automatisch.</li>
        </ul>
        <h2>Verantwortlich</h2>
        <p>
          Alexander Sulschani, Schaffhauserstrasse 6, 8180 Bülach, Schweiz. Fragen zum Datenschutz und Auskunftsbegehren an{' '}
          <a href="mailto:kontakt@lichtung.ch">kontakt@lichtung.ch</a>. Weitere Angaben im <a href="/impressum">Impressum</a>.
        </p>
      </div>
    </PublicShell>
  )
}

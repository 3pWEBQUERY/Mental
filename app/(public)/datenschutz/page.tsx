import type { Metadata } from 'next'
import { PublicShell } from '@/components/ui'

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
          <li>Sitzungen mit Gerätetyp und Datum, ohne IP-Adresse.</li>
          <li>IP-Adressen nur gesalzen gehasht für den Schutz vor Missbrauch. Nach 24 Stunden werden sie gelöscht.</li>
        </ul>
        <h2>Bilder</h2>
        <p>
          Bevor jemand dein Bild sieht, entfernen wir alle Metadaten (auch GPS und Kameradaten) und kodieren es neu. Bilder
          sind nie über eine öffentliche Adresse erreichbar, nur über kurzlebige Links für eingeloggte Mitglieder.
        </p>
        <h2>Wo deine Daten liegen</h2>
        <p>
          Alle Dienste laufen in Europa (Railway, Region EU West). Die EU gilt nach Schweizer Recht als Raum mit angemessenem
          Datenschutz. Mit allen Auftragsverarbeitern bestehen Verträge. Für die automatische Prüfung von Texten geht nur der
          Text an den Moderations-Anbieter, nie eine Konto- oder Pseudonym-ID.
        </p>
        <h2>Deine Rechte</h2>
        <ul className="dash">
          <li>Unter Einstellungen → Daten lädst du jederzeit alle deine Daten als ZIP herunter.</li>
          <li>Du kannst dein Konto jederzeit löschen. Nach 7 Tagen ist alles endgültig weg, auch Bilder.</li>
          <li>Konten ohne Login seit 24 Monaten löschen wir automatisch.</li>
        </ul>
      </div>
    </PublicShell>
  )
}

import type { Metadata } from 'next'
import { PublicShell } from '@/components/ui'

export const metadata: Metadata = { title: 'Impressum' }

/** Impressum nach Schweizer Recht. */
export default function ImprintPage() {
  return (
    <PublicShell>
      <div className="prose" style={{ margin: '0 auto' }}>
        <h1 className="display">Impressum</h1>
        {/* Rechtstexte gibt es vorerst nur auf Deutsch – die französische Fassung folgt nach rechtlicher Prüfung. */}
        <p className="fine" lang="fr">
          Ce texte juridique n’existe pour l’instant qu’en allemand. Une version française suivra après vérification juridique.
        </p>

        <h2>Verantwortlich für Lichtung</h2>
        <address className="imprint">
          Alexander Sulschani
          <br />
          Schaffhauserstrasse 6
          <br />
          8180 Bülach
          <br />
          Schweiz
          <br />
          <br />
          E-Mail: <a href="mailto:kontakt@lichtung.ch">kontakt@lichtung.ch</a>
        </address>
        <p className="fine">
          Per E-Mail gibt es keine Krisenberatung, und wir lesen sie nicht rund um die Uhr. Wenn es dir gerade schlecht geht:
          Die Nummern unten erreichst du sofort.
        </p>

        <h2>Kein Notfalldienst</h2>
        <p>
          Lichtung ist ein Ort zum Teilen und Zuhören und ersetzt keine Therapie, Beratung oder ärztliche Behandlung. In
          einer Krise erreichst du rund um die Uhr Die Dargebotene Hand unter <a href="tel:143">143</a>, Pro Juventute
          unter <a href="tel:147">147</a> und bei akuter Gefahr den Notruf <a href="tel:144">144</a>.
        </p>

        <h2>Haftungsausschluss</h2>
        <p>
          Die Inhalte dieser Website werden mit grösster Sorgfalt erstellt. Für die Richtigkeit, Vollständigkeit und
          Aktualität der Inhalte kann jedoch keine Gewähr übernommen werden. Beiträge von Mitgliedern geben deren eigene
          Erfahrungen wieder, nicht die Meinung des Betreibers, und sind keine fachliche Empfehlung.
        </p>

        <h2>Haftung für Links</h2>
        <p>
          Verweise auf Websites Dritter liegen ausserhalb unseres Verantwortungsbereichs. Für deren Inhalte sind
          ausschliesslich die jeweiligen Anbieter verantwortlich.
        </p>

        <h2>Urheberrechte</h2>
        <p>
          Gestaltung, Texte und Grafiken von Lichtung gehören dem Betreiber. Beiträge bleiben bei den Mitgliedern, die
          sie verfasst haben.
        </p>
      </div>
    </PublicShell>
  )
}

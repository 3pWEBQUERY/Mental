/**
 * Stammdaten: Kreise, Hilfe-Nummern, Krisen-Wortliste, kleine Schritte.
 * Idempotent – kann bei jedem Deployment laufen.
 */
import { sql } from 'drizzle-orm'
import { DEFAULT_CRISIS_TERMS, DEFAULT_CRISIS_TERMS_FR } from '../lib/crisis'
import { DEFAULT_HELP, DEFAULT_HELP_FR } from '../lib/help'
import { db, pool } from './index'
import { circles, crisisTerms, helpResources, steps } from './schema'

const CIRCLES = [
  {
    slug: 'selbstliebe',
    name: 'Selbstliebe',
    color: '#C4583A',
    description: 'Für Selbstwert, Körperbild und die kleinen Momente, in denen man sich selbst ein bisschen freundlicher ansieht.',
    rules: 'Keine Kommentare zu Körpern oder Gewicht. Kein Vergleichen.',
  },
  {
    slug: 'depression',
    name: 'Depression',
    color: '#5C6F86',
    description: 'Für schwere Tage, graue Wochen und jeden Schritt, der mehr Kraft kostet, als andere sehen.',
    rules: 'Keine Ratschläge wie «geh doch mal raus». Keine Diagnosen, keine Medikamenten-Tipps.',
  },
  {
    slug: 'angst',
    name: 'Angst',
    color: '#7D8790',
    description: 'Für Herzrasen, Grübeln, Panik und die Gespräche, vor denen man sich fürchtet.',
    rules: 'Keine Verharmlosung. Erfahrungen teilen statt Anweisungen geben.',
  },
  {
    slug: 'einsamkeit',
    name: 'Einsamkeit',
    color: '#B89A62',
    description: 'Für stille Sonntage, leere Wohnungen und das Gefühl, nicht gesehen zu werden.',
    rules: 'Keine Kontaktdaten tauschen, keine Treffen vereinbaren – auch wenn es gut gemeint ist.',
  },
  {
    slug: 'trauer',
    name: 'Trauer',
    color: '#1C1C1A',
    description: 'Für Verlust in jeder Form. Hier darf Trauer so lange dauern, wie sie dauert.',
    rules: 'Keine Aussagen wie «Die Zeit heilt alle Wunden». Einfach da sein.',
  },
  {
    slug: 'burnout',
    name: 'Burnout',
    color: '#55694D',
    description: 'Für Erschöpfung, Druck und den Moment, in dem man merkt, dass es zu viel wird.',
    rules: 'Keine Firmennamen, keine Namen von Kolleg:innen oder Vorgesetzten.',
  },
]

const STEPS: { text: string; circle?: string }[] = [
  { text: 'Trink ein Glas Wasser – langsam, ohne Handy.' },
  { text: 'Schreib einen Satz auf, den du einer Freundin in deiner Lage sagen würdest.', circle: 'selbstliebe' },
  { text: 'Geh fünf Minuten nach draussen. Ziel egal.' },
  { text: 'Öffne das Fenster und atme dreimal tief.' },
  { text: 'Schick einem Menschen eine kurze Nachricht. Einfach «Hey».', circle: 'einsamkeit' },
  { text: 'Stell dir einen Wecker für eine Pause – und nimm sie auch.', circle: 'burnout' },
  { text: 'Nenne fünf Dinge, die du gerade sehen kannst.', circle: 'angst' },
  { text: 'Zünde eine Kerze an und denk an etwas Schönes, das ihr geteilt habt.', circle: 'trauer' },
  { text: 'Wasch dir das Gesicht mit kaltem Wasser. Nur das.', circle: 'depression' },
  { text: 'Iss heute etwas Warmes.' },
  { text: 'Leg die Hand aufs Herz und zähl zehn Atemzüge.' },
]

async function main() {
  for (const [i, c] of CIRCLES.entries()) {
    await db
      .insert(circles)
      .values({ ...c, sort: i })
      // Nur anlegen: Namen, Farben und Reihenfolge pflegt das Admin-Team, ein Deploy überschreibt sie nicht.
      .onConflictDoNothing({ target: circles.slug })
  }

  // Pro Sprache nur anlegen, solange es dort noch nichts gibt – danach pflegt das Admin-Team die Liste.
  const helpCount = async (language: string) =>
    (await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM help_resources WHERE language = ${language}`)).rows[0]?.n ?? 0
  if ((await helpCount('de')) === 0) {
    await db.insert(helpResources).values([
      ...DEFAULT_HELP.map((h, i) => ({ ...h, sort: i * 10 })),
      { name: 'Chat der Dargebotenen Hand', phone: null, url: 'https://www.143.ch', hours: 'täglich', audience: 'schreiben statt reden', sort: 40 },
      { name: 'Chat von Pro Juventute', phone: null, url: 'https://www.147.ch', hours: 'rund um die Uhr', audience: 'für Kinder und Jugendliche, auch per SMS', sort: 50 },
    ])
  }
  if ((await helpCount('fr')) === 0) {
    await db.insert(helpResources).values(
      [
        ...DEFAULT_HELP_FR.map((h, i) => ({ ...h, sort: i * 10 })),
        { name: 'Chat de La Main Tendue', phone: null, url: 'https://www.143.ch', hours: 'tous les jours', audience: 'écrire plutôt que parler', sort: 40 },
        { name: 'Chat de Pro Juventute', phone: null, url: 'https://www.147.ch', hours: '24 h sur 24', audience: 'pour les enfants et les jeunes, aussi par SMS', sort: 50 },
      ].map((h) => ({ ...h, language: 'fr' })),
    )
  }

  // Neue Standardbegriffe kommen dazu; entfernte bleiben als inaktiv bestehen und werden nicht reaktiviert.
  await db
    .insert(crisisTerms)
    .values([
      ...DEFAULT_CRISIS_TERMS.map((t) => ({ term: t.term, level: t.level, language: 'de' })),
      ...DEFAULT_CRISIS_TERMS_FR.map((t) => ({ term: t.term, level: t.level, language: 'fr' })),
    ])
    .onConflictDoNothing()

  const [{ n: stepCount } = { n: 0 }] = (await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM steps`)).rows
  if (stepCount === 0) {
    const rows = await db.select({ id: circles.id, slug: circles.slug }).from(circles)
    await db.insert(steps).values(
      STEPS.map((s, i) => ({ text: s.text, sort: i, circleId: s.circle ? rows.find((r) => r.slug === s.circle)?.id ?? null : null })),
    )
  }
  console.log('Seed fertig.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => pool.end())

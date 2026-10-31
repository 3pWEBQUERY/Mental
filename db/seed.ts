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
    fr: { name: 'Amour de soi', description: 'Pour l’estime de soi, l’image du corps et les petits moments où l’on se regarde avec un peu plus de douceur.', rules: 'Pas de commentaires sur les corps ou le poids. Pas de comparaisons.' },
  },
  {
    slug: 'depression',
    name: 'Depression',
    color: '#5C6F86',
    description: 'Für schwere Tage, graue Wochen und jeden Schritt, der mehr Kraft kostet, als andere sehen.',
    rules: 'Keine Ratschläge wie «geh doch mal raus». Keine Diagnosen, keine Medikamenten-Tipps.',
    fr: { name: 'Dépression', description: 'Pour les jours lourds, les semaines grises et chaque pas qui coûte plus de force que ce que les autres voient.', rules: 'Pas de conseils du genre « sors un peu ». Pas de diagnostics, pas de conseils sur les médicaments.' },
  },
  {
    slug: 'angst',
    name: 'Angst',
    color: '#7D8790',
    description: 'Für Herzrasen, Grübeln, Panik und die Gespräche, vor denen man sich fürchtet.',
    rules: 'Keine Verharmlosung. Erfahrungen teilen statt Anweisungen geben.',
    fr: { name: 'Anxiété', description: 'Pour le cœur qui s’emballe, les ruminations, la panique et les conversations qu’on redoute.', rules: 'Ne pas minimiser. Partager des expériences plutôt que donner des consignes.' },
  },
  {
    slug: 'einsamkeit',
    name: 'Einsamkeit',
    color: '#B89A62',
    description: 'Für stille Sonntage, leere Wohnungen und das Gefühl, nicht gesehen zu werden.',
    rules: 'Keine Kontaktdaten tauschen, keine Treffen vereinbaren – auch wenn es gut gemeint ist.',
    fr: { name: 'Solitude', description: 'Pour les dimanches silencieux, les appartements vides et le sentiment de ne pas être vu·e.', rules: 'Pas d’échange de coordonnées, pas de rendez-vous – même avec de bonnes intentions.' },
  },
  {
    slug: 'trauer',
    name: 'Trauer',
    color: '#1C1C1A',
    description: 'Für Verlust in jeder Form. Hier darf Trauer so lange dauern, wie sie dauert.',
    rules: 'Keine Aussagen wie «Die Zeit heilt alle Wunden». Einfach da sein.',
    fr: { name: 'Deuil', description: 'Pour la perte sous toutes ses formes. Ici, le deuil peut durer aussi longtemps qu’il dure.', rules: 'Pas de phrases comme « le temps guérit toutes les blessures ». Simplement être là.' },
  },
  {
    slug: 'burnout',
    name: 'Burnout',
    color: '#55694D',
    description: 'Für Erschöpfung, Druck und den Moment, in dem man merkt, dass es zu viel wird.',
    rules: 'Keine Firmennamen, keine Namen von Kolleg:innen oder Vorgesetzten.',
    fr: { name: 'Épuisement', description: 'Pour l’épuisement, la pression et le moment où l’on remarque que c’en est trop.', rules: 'Pas de noms d’entreprises, pas de noms de collègues ou de supérieur·es.' },
  },
]

const STEPS: { text: string; fr: string; circle?: string }[] = [
  { text: 'Trink ein Glas Wasser – langsam, ohne Handy.', fr: 'Bois un verre d’eau – lentement, sans téléphone.' },
  { text: 'Schreib einen Satz auf, den du einer Freundin in deiner Lage sagen würdest.', fr: 'Écris une phrase que tu dirais à une amie dans ta situation.', circle: 'selbstliebe' },
  { text: 'Geh fünf Minuten nach draussen. Ziel egal.', fr: 'Sors cinq minutes. Peu importe où.' },
  { text: 'Öffne das Fenster und atme dreimal tief.', fr: 'Ouvre la fenêtre et respire profondément trois fois.' },
  { text: 'Schick einem Menschen eine kurze Nachricht. Einfach «Hey».', fr: 'Envoie un petit message à quelqu’un. Juste « Salut ».', circle: 'einsamkeit' },
  { text: 'Stell dir einen Wecker für eine Pause – und nimm sie auch.', fr: 'Mets un réveil pour une pause – et prends-la vraiment.', circle: 'burnout' },
  { text: 'Nenne fünf Dinge, die du gerade sehen kannst.', fr: 'Nomme cinq choses que tu peux voir en ce moment.', circle: 'angst' },
  { text: 'Zünde eine Kerze an und denk an etwas Schönes, das ihr geteilt habt.', fr: 'Allume une bougie et pense à quelque chose de beau que vous avez partagé.', circle: 'trauer' },
  { text: 'Wasch dir das Gesicht mit kaltem Wasser. Nur das.', fr: 'Passe-toi de l’eau froide sur le visage. Juste ça.', circle: 'depression' },
  { text: 'Iss heute etwas Warmes.', fr: 'Mange quelque chose de chaud aujourd’hui.' },
  { text: 'Leg die Hand aufs Herz und zähl zehn Atemzüge.', fr: 'Pose la main sur ton cœur et compte dix respirations.' },
]

async function main() {
  for (const [i, { fr, ...c }] of CIRCLES.entries()) {
    await db
      .insert(circles)
      .values({ ...c, sort: i, i18n: { fr } })
      // Nur anlegen: Namen, Farben und Reihenfolge pflegt das Admin-Team, ein Deploy überschreibt sie nicht.
      .onConflictDoNothing({ target: circles.slug })
    // Bestehende Kreise bekommen die französische Fassung einmal dazu – eine gepflegte bleibt unangetastet.
    await db.execute(
      sql`UPDATE circles SET i18n = i18n || jsonb_build_object('fr', ${JSON.stringify(fr)}::jsonb) WHERE slug = ${c.slug} AND NOT (i18n ? 'fr')`,
    )
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
      STEPS.map((s, i) => ({
        text: s.text,
        i18n: { fr: { text: s.fr } },
        sort: i,
        circleId: s.circle ? (rows.find((r) => r.slug === s.circle)?.id ?? null) : null,
      })),
    )
  }
  // Bestehende Standard-Schritte (gleicher deutscher Text) bekommen die Übersetzung einmal dazu.
  for (const s of STEPS)
    await db.execute(
      sql`UPDATE steps SET i18n = i18n || jsonb_build_object('fr', jsonb_build_object('text', ${s.fr}::text)) WHERE text = ${s.text} AND NOT (i18n ? 'fr')`,
    )
  // Passkeys von vor der Spalte rp_id gehören zur Domain, die jetzt gilt. Läuft dieses Deploy noch auf der alten
  // Domain, sind sie damit richtig markiert – nach dem Wechsel auf jiaia.app zählen sie nicht mehr (passkey-actions.ts).
  const rpId = process.env.WEBAUTHN_RP_ID ?? new URL(process.env.APP_URL ?? 'http://localhost:3000').hostname
  await db.execute(sql`UPDATE passkeys SET rp_id = ${rpId} WHERE rp_id IS NULL`)
  console.log('Seed fertig.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => pool.end())

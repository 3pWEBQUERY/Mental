/**
 * Kreise vom November 2026 und Hilfe je Kreis (de/fr/it).
 * Die Hilfe-Stellen sind vor dem öffentlichen Einsatz zu prüfen: docs/kreise-hilfe-pruefung.md.
 */

type Lang = 'de' | 'fr' | 'it'
type Text = { name: string; description: string; rules: string }
type Help = { name: string; phone: string | null; url: string | null; hours: string; audience: string }

export const NEW_CIRCLES: (Text & { slug: string; color: string; requireCw: boolean; fr: Text; it: Text })[] = [
  {
    slug: 'beziehungen-familie',
    name: 'Beziehungen & Familie',
    color: '#A8536B',
    requireCw: false,
    description: 'Für Liebeskummer, Trennung, Streit zu Hause und Menschen, die einem nahe sind – manchmal zu nah.',
    rules: 'Keine Namen und nichts, woran andere erkennbar sind. Bei Gewalt: Inhaltshinweis einschalten – Hilfe holen ist kein Verrat.',
    fr: {
      name: 'Relations & famille',
      description: 'Pour le chagrin d’amour, les séparations, les disputes à la maison et les personnes qui nous sont proches – parfois trop.',
      rules: 'Pas de noms ni de détails qui permettent de reconnaître quelqu’un. En cas de violence : active l’avertissement de contenu – chercher de l’aide n’est pas une trahison.',
    },
    it: {
      name: 'Relazioni e famiglia',
      description: 'Per le pene d’amore, le separazioni, i litigi a casa e le persone che ci sono vicine – a volte troppo.',
      rules: 'Niente nomi né dettagli che rendano riconoscibile qualcuno. In caso di violenza: attiva l’avviso sui contenuti – chiedere aiuto non è un tradimento.',
    },
  },
  {
    slug: 'schule-ausbildung',
    name: 'Schule & Ausbildung',
    color: '#4F7A8C',
    requireCw: false,
    description: 'Für Prüfungsangst, Lehrstellensuche, Studium, Leistungsdruck und Tage, an denen man nicht hingehen mag.',
    rules: 'Keine Namen von Schulen, Betrieben, Lehrpersonen oder Mitschüler:innen. Keine Noten vergleichen.',
    fr: {
      name: 'École & formation',
      description: 'Pour le trac des examens, la recherche d’apprentissage, les études, la pression de réussir et les jours où l’on n’a pas envie d’y aller.',
      rules: 'Pas de noms d’écoles, d’entreprises, d’enseignant·es ou de camarades. Pas de comparaison de notes.',
    },
    it: {
      name: 'Scuola e formazione',
      description: 'Per l’ansia da esame, la ricerca di un apprendistato, gli studi, la pressione di rendere e i giorni in cui non si ha voglia di andarci.',
      rules: 'Niente nomi di scuole, aziende, docenti o compagni di classe. Niente confronti tra voti.',
    },
  },
  {
    slug: 'schlaf',
    name: 'Schlaf',
    color: '#3F4A6B',
    requireCw: false,
    description: 'Für Nächte, in denen die Gedanken nicht leiser werden, und Morgen, an denen das Aufstehen zu schwer ist.',
    rules: 'Keine Tipps zu Schlafmitteln oder Medikamenten. Erfahrungen teilen statt Rezepte geben.',
    fr: {
      name: 'Sommeil',
      description: 'Pour les nuits où les pensées ne se calment pas et les matins où se lever est trop dur.',
      rules: 'Pas de conseils sur les somnifères ou les médicaments. Partager des expériences plutôt que des recettes.',
    },
    it: {
      name: 'Sonno',
      description: 'Per le notti in cui i pensieri non si calmano e le mattine in cui alzarsi è troppo difficile.',
      rules: 'Niente consigli su sonniferi o farmaci. Condividere esperienze invece di ricette.',
    },
  },
  {
    slug: 'angehoerige',
    name: 'Angehörige',
    color: '#7A6A4F',
    // Hier geht es oft um Suizidversuche, Psychosen oder Klinikaufenthalte nahestehender Menschen.
    requireCw: true,
    description: 'Für alle, die jemanden begleiten, dem es psychisch nicht gut geht – und dabei selbst an Grenzen kommen.',
    rules: 'Über die andere Person nur so viel wie nötig – ohne Namen und ohne Diagnosen anderer. Eigene Grenzen sind erlaubt.',
    fr: {
      name: 'Proches',
      description: 'Pour toutes celles et ceux qui accompagnent une personne qui ne va pas bien psychiquement – et qui arrivent eux-mêmes à leurs limites.',
      rules: 'Ne dire de l’autre personne que le nécessaire – sans noms ni diagnostics d’autrui. Avoir ses propres limites est permis.',
    },
    it: {
      name: 'Familiari e amici',
      description: 'Per chi accompagna una persona che non sta bene psichicamente – e arriva a sua volta ai propri limiti.',
      rules: 'Dell’altra persona solo il necessario – senza nomi né diagnosi altrui. I propri limiti sono permessi.',
    },
  },
  {
    slug: 'queer',
    name: 'Queer & Identität',
    color: '#8B5FA8',
    requireCw: false,
    description: 'Für Coming-out, Fragen zur eigenen Identität, Ablehnung und den Wunsch, einfach so sein zu dürfen.',
    rules: 'Keine Diskussion darüber, ob jemand «wirklich» so ist. Niemanden outen, keine Namen.',
    fr: {
      name: 'Queer & identité',
      description: 'Pour le coming out, les questions sur sa propre identité, le rejet et l’envie de pouvoir simplement être soi.',
      rules: 'Pas de débat pour savoir si quelqu’un l’est « vraiment ». N’outer personne, pas de noms.',
    },
    it: {
      name: 'Queer e identità',
      description: 'Per il coming out, le domande sulla propria identità, il rifiuto e il desiderio di poter essere semplicemente sé stessi.',
      rules: 'Nessuna discussione sul fatto che qualcuno lo sia «davvero». Non fare outing a nessuno, niente nomi.',
    },
  },
  {
    slug: 'gute-momente',
    name: 'Gute Momente',
    color: '#B8862E',
    requireCw: false,
    description: 'Für das, was heute gutgetan hat – auch wenn es klein war. Damit es hier nicht nur schwer ist.',
    rules: 'Kein Vergleichen und kein «Bei mir ist es aber schlimmer». Freude teilen ist erlaubt.',
    fr: {
      name: 'Bons moments',
      description: 'Pour ce qui a fait du bien aujourd’hui – même si c’était petit. Pour qu’ici, tout ne soit pas lourd.',
      rules: 'Pas de comparaison, pas de « pour moi c’est pire ». Partager sa joie est permis.',
    },
    it: {
      name: 'Momenti belli',
      description: 'Per ciò che oggi ha fatto bene – anche se era piccolo. Perché qui non sia tutto pesante.',
      rules: 'Niente confronti e niente «per me è peggio». Condividere la gioia è permesso.',
    },
  },
  {
    // Ohne eigene Wahl landet ein neuer Gedanke hier (components/app/composer.tsx, DEFAULT_CIRCLE).
    slug: 'einfach-so',
    name: 'Einfach so',
    color: '#8A7F72',
    requireCw: false,
    description: 'Für alles, was in keinen anderen Kreis passt – ein komischer Tag, ein Gedanke, der raus will.',
    rules: 'Kein Thema ist zu klein. Freundlich bleiben, nicht bewerten.',
    fr: {
      name: 'Juste comme ça',
      description: 'Pour tout ce qui n’entre dans aucun autre cercle – une journée bizarre, une pensée qui veut sortir.',
      rules: 'Aucun sujet n’est trop petit. Rester bienveillant·e, ne pas juger.',
    },
    it: {
      name: 'Così, semplicemente',
      description: 'Per tutto ciò che non rientra in nessun altro cerchio – una giornata strana, un pensiero che vuole uscire.',
      rules: 'Nessun tema è troppo piccolo. Restare gentili, non giudicare.',
    },
  },
]

export const NEW_STEPS: { text: string; fr: string; it: string; circle: string }[] = [
  { circle: 'einfach-so', text: 'Schreib drei Wörter auf, die deinen Tag beschreiben.', fr: 'Écris trois mots qui décrivent ta journée.', it: 'Scrivi tre parole che descrivono la tua giornata.' },
  { circle: 'einfach-so', text: 'Streck dich einmal ganz lang – Arme hoch, tief ausatmen.', fr: 'Étire-toi de tout ton long – bras en l’air, expire profondément.', it: 'Stirati per bene – braccia in alto, espira a fondo.' },
  { circle: 'beziehungen-familie', text: 'Schreib auf, was du der Person gern sagen würdest – abschicken musst du es nicht.', fr: 'Écris ce que tu aimerais dire à cette personne – tu n’as pas besoin de l’envoyer.', it: 'Scrivi ciò che vorresti dire a quella persona – non devi inviarlo.' },
  { circle: 'beziehungen-familie', text: 'Gönn dir heute eine Stunde nur für dich, ohne erreichbar zu sein.', fr: 'Accorde-toi aujourd’hui une heure rien que pour toi, sans être joignable.', it: 'Concediti oggi un’ora solo per te, senza essere raggiungibile.' },
  { circle: 'schule-ausbildung', text: 'Teil die nächste Aufgabe in drei kleine Teile und mach nur den ersten.', fr: 'Divise la prochaine tâche en trois petites parties et ne fais que la première.', it: 'Dividi il prossimo compito in tre piccole parti e fai solo la prima.' },
  { circle: 'schule-ausbildung', text: 'Leg das Handy für 25 Minuten in einen anderen Raum.', fr: 'Mets ton téléphone dans une autre pièce pendant 25 minutes.', it: 'Metti il telefono in un’altra stanza per 25 minuti.' },
  { circle: 'schule-ausbildung', text: 'Schreib auf, was du diese Woche geschafft hast – auch Kleines.', fr: 'Écris ce que tu as réussi cette semaine – même les petites choses.', it: 'Scrivi cosa hai portato a termine questa settimana – anche le piccole cose.' },
  { circle: 'schlaf', text: 'Leg das Handy eine halbe Stunde vor dem Schlafen weg.', fr: 'Pose ton téléphone une demi-heure avant de dormir.', it: 'Metti via il telefono mezz’ora prima di dormire.' },
  { circle: 'schlaf', text: 'Schreib die Gedanken, die kreisen, auf einen Zettel neben dem Bett.', fr: 'Note les pensées qui tournent en rond sur un papier à côté du lit.', it: 'Scrivi i pensieri che girano su un foglio accanto al letto.' },
  { circle: 'schlaf', text: 'Geh morgen bei Tageslicht fünf Minuten nach draussen.', fr: 'Demain, sors cinq minutes à la lumière du jour.', it: 'Domani esci cinque minuti alla luce del giorno.' },
  { circle: 'angehoerige', text: 'Mach heute etwas nur für dich – ohne schlechtes Gewissen.', fr: 'Fais aujourd’hui quelque chose rien que pour toi – sans culpabiliser.', it: 'Oggi fai qualcosa solo per te – senza sensi di colpa.' },
  { circle: 'angehoerige', text: 'Sag einer Person, der du vertraust, wie es dir selbst gerade geht.', fr: 'Dis à une personne de confiance comment toi, tu vas en ce moment.', it: 'Di’ a una persona di fiducia come stai tu in questo momento.' },
  { circle: 'queer', text: 'Denk an einen Ort oder Menschen, bei dem du ganz du sein kannst.', fr: 'Pense à un lieu ou à une personne avec qui tu peux être pleinement toi.', it: 'Pensa a un luogo o a una persona con cui puoi essere pienamente te.' },
  { circle: 'queer', text: 'Schreib einen Satz auf, den du deinem jüngeren Ich sagen würdest.', fr: 'Écris une phrase que tu dirais à toi plus jeune.', it: 'Scrivi una frase che diresti a te da più giovane.' },
  { circle: 'gute-momente', text: 'Schreib drei Dinge auf, die heute gut waren – auch winzige.', fr: 'Écris trois choses qui ont été bien aujourd’hui – même minuscules.', it: 'Scrivi tre cose che oggi sono andate bene – anche minuscole.' },
  { circle: 'gute-momente', text: 'Erzähl jemandem von etwas Schönem, das du erlebt hast.', fr: 'Raconte à quelqu’un quelque chose de beau que tu as vécu.', it: 'Racconta a qualcuno qualcosa di bello che hai vissuto.' },
]

// Wiederkehrende Stellen. Die Nummern 143 und 147 gelten in der ganzen Schweiz und in allen drei Sprachen.
const H143 = { de: 'Die Dargebotene Hand', fr: 'La Main Tendue', it: 'Telefono Amico' }
const day = { de: 'rund um die Uhr', fr: '24 h sur 24', it: '24 ore su 24' }
const l143 = (l: Lang, audience: string): Help => ({ name: H143[l], phone: '143', url: 'https://www.143.ch', hours: day[l], audience })
const l147 = (l: Lang, audience: string): Help => ({ name: 'Pro Juventute', phone: '147', url: 'https://www.147.ch', hours: day[l], audience })

/** Hilfe je Kreis und Sprache. Kreise ohne Eintrag zeigen nur die allgemeine Hilfe. */
export const CIRCLE_HELP: Record<string, Record<Lang, Help[]>> = {
  depression: {
    de: [
      { name: 'Equilibrium', phone: null, url: 'https://www.depressionen.ch', hours: 'Infos und Selbsthilfegruppen', audience: 'bei Depression, auch für Angehörige' },
      l143('de', 'wenn alles schwer ist'),
    ],
    fr: [l143('fr', 'quand tout est lourd')],
    it: [l143('it', 'quando tutto pesa')],
  },
  angst: {
    de: [
      { name: 'Angst- und Panikhilfe Schweiz (APhS)', phone: null, url: 'https://www.aphs.ch', hours: 'Infos und Selbsthilfe', audience: 'bei Angst und Panik' },
      l143('de', 'auch mitten in der Panik'),
    ],
    fr: [l143('fr', 'même en pleine panique')],
    it: [l143('it', 'anche nel mezzo del panico')],
  },
  selbstliebe: {
    de: [
      { name: 'Arbeitsgemeinschaft Ess-Störungen (AES)', phone: null, url: 'https://www.aes.ch', hours: 'Infos und Beratungsstellen', audience: 'bei Essstörungen' },
      l147('de', 'für Kinder & Jugendliche'),
    ],
    fr: [l147('fr', 'pour les enfants et les jeunes')],
    it: [l147('it', 'per bambini e giovani')],
  },
  einsamkeit: {
    de: [l143('de', 'wenn gerade niemand da ist')],
    fr: [l143('fr', 'quand personne n’est là')],
    it: [l143('it', 'quando non c’è nessuno')],
  },
  trauer: {
    de: [l143('de', 'auch zum Reden über einen Verlust')],
    fr: [l143('fr', 'aussi pour parler d’une perte')],
    it: [l143('it', 'anche per parlare di una perdita')],
  },
  burnout: {
    de: [l143('de', 'wenn es zu viel wird')],
    fr: [l143('fr', 'quand c’en est trop')],
    it: [l143('it', 'quando è troppo')],
  },
  'beziehungen-familie': {
    de: [
      { name: 'Opferhilfe Schweiz', phone: null, url: 'https://www.opferhilfe-schweiz.ch', hours: 'kostenlos und vertraulich', audience: 'bei Gewalt in Beziehung oder Familie' },
      l147('de', 'für Junge, auch bei Stress zu Hause'),
      l143('de', 'bei Liebeskummer und Streit'),
    ],
    fr: [
      { name: 'Aide aux victimes', phone: null, url: 'https://www.aide-aux-victimes.ch', hours: 'gratuit et confidentiel', audience: 'en cas de violence dans le couple ou la famille' },
      l147('fr', 'pour les jeunes, aussi en cas de tensions à la maison'),
      l143('fr', 'chagrin d’amour, disputes'),
    ],
    it: [
      { name: 'Aiuto alle vittime', phone: null, url: 'https://www.aiuto-alle-vittime.ch', hours: 'gratuito e confidenziale', audience: 'in caso di violenza nella coppia o in famiglia' },
      l147('it', 'per giovani, anche in caso di tensioni a casa'),
      l143('it', 'pene d’amore, litigi'),
    ],
  },
  'schule-ausbildung': {
    de: [l147('de', 'bei Stress mit Schule oder Lehre'), l143('de', 'auch für Studierende')],
    fr: [l147('fr', 'stress à l’école ou en apprentissage'), l143('fr', 'aussi pour les étudiant·es')],
    it: [l147('it', 'stress a scuola o in apprendistato'), l143('it', 'anche per chi studia')],
  },
  schlaf: {
    de: [l143('de', 'wenn nachts die Gedanken kreisen')],
    fr: [l143('fr', 'quand les pensées tournent la nuit')],
    it: [l143('it', 'quando di notte i pensieri girano')],
  },
  angehoerige: {
    de: [
      { name: 'Pro Mente Sana', phone: null, url: 'https://www.promentesana.ch', hours: 'Beratung und Infos', audience: 'für Angehörige psychisch belasteter Menschen' },
      { name: 'VASK Schweiz', phone: null, url: 'https://www.vask.ch', hours: 'Angehörigengruppen', audience: 'für Angehörige' },
      l143('de', 'auch für Angehörige'),
    ],
    fr: [l143('fr', 'aussi pour les proches')],
    it: [l143('it', 'anche per familiari e amici')],
  },
  queer: {
    de: [
      { name: 'du-bist-du', phone: null, url: 'https://www.du-bist-du.ch', hours: 'Beratung durch Peers', audience: 'für junge queere Menschen' },
      { name: 'Transgender Network Switzerland', phone: null, url: 'https://www.tgns.ch', hours: 'Infos und Beratung', audience: 'für trans und nicht-binäre Menschen' },
      l147('de', 'für Junge, auch beim Coming-out'),
    ],
    fr: [
      { name: 'Fondation Agnodice', phone: null, url: 'https://www.agnodice.ch', hours: 'accompagnement', audience: 'pour les jeunes trans et en questionnement' },
      l147('fr', 'pour les jeunes, aussi lors du coming out'),
    ],
    it: [
      { name: 'Imbarco Immediato', phone: null, url: 'https://www.imbarcoimmediato.ch', hours: 'consulenza e incontri', audience: 'per persone LGBTIQ in Ticino' },
      l147('it', 'per giovani, anche per il coming out'),
    ],
  },
}

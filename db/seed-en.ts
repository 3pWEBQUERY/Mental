/**
 * Englische Fassung der Standardinhalte (Kreise, kleine Schritte, Hilfe je Kreis, allgemeine Hilfe).
 * Gleiche Schlüssel, Nummern und URLs wie db/seed.ts, db/seed-kreise.ts und lib/help.ts.
 */
import type { HelpResource } from '../lib/help'

type Text = { name: string; description: string; rules: string }
type Help = HelpResource

/** English name/description/rules for every default circle, keyed by slug (all slugs from CIRCLES and NEW_CIRCLES). */
export const CIRCLES_EN: Record<string, Text> = {
  selbstliebe: {
    name: 'Self-love',
    description: 'For self-worth, body image and the small moments when you look at yourself a little more kindly.',
    rules: 'No comments about bodies or weight. No comparing.',
  },
  depression: {
    name: 'Depression',
    description: 'For heavy days, grey weeks and every step that takes more strength than others can see.',
    rules: 'No advice like “just get out more”. No diagnoses, no tips about medication.',
  },
  angst: {
    name: 'Anxiety',
    description: 'For a racing heart, overthinking, panic and the conversations you dread.',
    rules: 'Don’t play things down. Share experiences rather than give instructions.',
  },
  einsamkeit: {
    name: 'Loneliness',
    description: 'For quiet Sundays, empty flats and the feeling of not being seen.',
    rules: 'Don’t swap contact details or arrange to meet – even with the best intentions.',
  },
  trauer: {
    name: 'Grief',
    description: 'For loss in every form. Here, grief can take as long as it takes.',
    rules: 'No sayings like “time heals all wounds”. Just be there.',
  },
  burnout: {
    name: 'Burnout',
    description: 'For exhaustion, pressure and the moment you notice it’s becoming too much.',
    rules: 'No company names, no names of colleagues or managers.',
  },
  'beziehungen-familie': {
    name: 'Relationships & family',
    description: 'For heartbreak, breakups, arguments at home and the people who are close to you – sometimes too close.',
    rules: 'No names and nothing that could identify anyone. If there’s violence: turn on the content warning – getting help is not betrayal.',
  },
  'schule-ausbildung': {
    name: 'School & training',
    description: 'For exam nerves, looking for an apprenticeship, studying, pressure to perform and days when you don’t want to go.',
    rules: 'No names of schools, companies, teachers or classmates. No comparing grades.',
  },
  schlaf: {
    name: 'Sleep',
    description: 'For nights when your thoughts won’t quieten down, and mornings when getting up is too hard.',
    rules: 'No tips about sleeping pills or medication. Share experiences rather than prescriptions.',
  },
  angehoerige: {
    name: 'Carers & loved ones',
    description: 'For everyone supporting someone who is struggling with their mental health – and reaching their own limits along the way.',
    rules: 'Say only as much about the other person as you need to – no names and no diagnoses of others. Your own limits are allowed.',
  },
  queer: {
    name: 'Queer & identity',
    description: 'For coming out, questions about who you are, rejection and the wish to simply be allowed to be yourself.',
    rules: 'No debating whether someone is “really” who they say they are. Don’t out anyone, no names.',
  },
  'gute-momente': {
    name: 'Good moments',
    description: 'For whatever did you good today – even if it was small. So that it’s not only heavy here.',
    rules: 'No comparing and no “but mine is worse”. Sharing joy is allowed.',
  },
  'einfach-so': {
    name: 'Just because',
    description: 'For anything that doesn’t fit into another circle – a strange day, a thought that wants to get out.',
    rules: 'No topic is too small. Stay kind, don’t judge.',
  },
}

/** English text for every default step, keyed by the exact German `text` (all entries of STEPS and NEW_STEPS). */
export const STEPS_EN: Record<string, string> = {
  // STEPS (db/seed.ts)
  'Trink ein Glas Wasser – langsam, ohne Handy.': 'Drink a glass of water – slowly, without your phone.',
  'Schreib einen Satz auf, den du einer Freundin in deiner Lage sagen würdest.': 'Write down one sentence you would say to a friend in your situation.',
  'Geh fünf Minuten nach draussen. Ziel egal.': 'Go outside for five minutes. It doesn’t matter where.',
  'Öffne das Fenster und atme dreimal tief.': 'Open the window and take three deep breaths.',
  'Schick einem Menschen eine kurze Nachricht. Einfach «Hey».': 'Send someone a short message. Just “Hey”.',
  'Stell dir einen Wecker für eine Pause – und nimm sie auch.': 'Set an alarm for a break – and actually take it.',
  'Nenne fünf Dinge, die du gerade sehen kannst.': 'Name five things you can see right now.',
  'Zünde eine Kerze an und denk an etwas Schönes, das ihr geteilt habt.': 'Light a candle and think of something lovely you shared.',
  'Wasch dir das Gesicht mit kaltem Wasser. Nur das.': 'Splash your face with cold water. Just that.',
  'Iss heute etwas Warmes.': 'Eat something warm today.',
  'Leg die Hand aufs Herz und zähl zehn Atemzüge.': 'Put your hand on your heart and count ten breaths.',
  // NEW_STEPS (db/seed-kreise.ts)
  'Schreib drei Wörter auf, die deinen Tag beschreiben.': 'Write down three words that describe your day.',
  'Streck dich einmal ganz lang – Arme hoch, tief ausatmen.': 'Have a really long stretch – arms up, breathe out deeply.',
  'Schreib auf, was du der Person gern sagen würdest – abschicken musst du es nicht.': 'Write down what you’d like to say to that person – you don’t have to send it.',
  'Gönn dir heute eine Stunde nur für dich, ohne erreichbar zu sein.': 'Give yourself an hour today just for you, without being reachable.',
  'Teil die nächste Aufgabe in drei kleine Teile und mach nur den ersten.': 'Split your next task into three small parts and only do the first one.',
  'Leg das Handy für 25 Minuten in einen anderen Raum.': 'Put your phone in another room for 25 minutes.',
  'Schreib auf, was du diese Woche geschafft hast – auch Kleines.': 'Write down what you managed this week – small things too.',
  'Leg das Handy eine halbe Stunde vor dem Schlafen weg.': 'Put your phone away half an hour before you go to sleep.',
  'Schreib die Gedanken, die kreisen, auf einen Zettel neben dem Bett.': 'Write the thoughts that keep circling on a piece of paper next to your bed.',
  'Geh morgen bei Tageslicht fünf Minuten nach draussen.': 'Tomorrow, go outside for five minutes in daylight.',
  'Mach heute etwas nur für dich – ohne schlechtes Gewissen.': 'Do something just for you today – without feeling guilty.',
  'Sag einer Person, der du vertraust, wie es dir selbst gerade geht.': 'Tell someone you trust how you yourself are doing right now.',
  'Denk an einen Ort oder Menschen, bei dem du ganz du sein kannst.': 'Think of a place or a person where you can be completely yourself.',
  'Schreib einen Satz auf, den du deinem jüngeren Ich sagen würdest.': 'Write down one sentence you would say to your younger self.',
  'Schreib drei Dinge auf, die heute gut waren – auch winzige.': 'Write down three things that were good today – even tiny ones.',
  'Erzähl jemandem von etwas Schönem, das du erlebt hast.': 'Tell someone about something lovely you experienced.',
}

// Recurring services. 143 and 147 work all over Switzerland.
const day = '24/7'
const h143 = (audience: string): Help => ({ name: 'Die Dargebotene Hand (Helping Hand)', phone: '143', url: 'https://www.143.ch', hours: day, audience })
const h147 = (audience: string): Help => ({ name: 'Pro Juventute', phone: '147', url: 'https://www.147.ch', hours: day, audience })

/** Per-circle help resources in English, keyed by slug – same entries/order as CIRCLE_HELP[slug].de (same phone numbers and URLs). */
export const CIRCLE_HELP_EN: Record<string, Help[]> = {
  depression: [
    { name: 'Equilibrium', phone: null, url: 'https://www.depressionen.ch', hours: 'information and self-help groups', audience: 'for depression, also for family and friends' },
    h143('when everything feels heavy'),
  ],
  angst: [
    { name: 'Angst- und Panikhilfe Schweiz (APhS, anxiety and panic support)', phone: null, url: 'https://www.aphs.ch', hours: 'information and self-help', audience: 'for anxiety and panic' },
    h143('even in the middle of a panic attack'),
  ],
  selbstliebe: [
    { name: 'Arbeitsgemeinschaft Ess-Störungen (AES, eating disorders)', phone: null, url: 'https://www.aes.ch', hours: 'information and counselling services', audience: 'for eating disorders' },
    h147('for children & young people'),
  ],
  einsamkeit: [h143('when there’s nobody around right now')],
  trauer: [h143('also to talk about a loss')],
  burnout: [h143('when it’s becoming too much')],
  'beziehungen-familie': [
    { name: 'Opferhilfe Schweiz (victim support)', phone: null, url: 'https://www.opferhilfe-schweiz.ch', hours: 'free and confidential', audience: 'if there’s violence in a relationship or family' },
    h147('for young people, also when things are stressful at home'),
    h143('for heartbreak and arguments'),
  ],
  'schule-ausbildung': [h147('for stress at school or in your apprenticeship'), h143('for students too')],
  schlaf: [h143('when your thoughts keep circling at night')],
  angehoerige: [
    { name: 'Pro Mente Sana', phone: null, url: 'https://www.promentesana.ch', hours: 'advice and information', audience: 'for family and friends of people with mental health struggles' },
    { name: 'VASK Schweiz', phone: null, url: 'https://www.vask.ch', hours: 'groups for family members', audience: 'for family and friends' },
    h143('for carers and loved ones too'),
  ],
  queer: [
    { name: 'du-bist-du', phone: null, url: 'https://www.du-bist-du.ch', hours: 'peer counselling', audience: 'for young queer people' },
    { name: 'Transgender Network Switzerland', phone: null, url: 'https://www.tgns.ch', hours: 'information and advice', audience: 'for trans and non-binary people' },
    h147('for young people, also when coming out'),
  ],
}

// Die allgemeine Liste für /help steht in lib/help.ts (DEFAULT_HELP_EN) – sie dient auch als Rückfall ohne Datenbank.

/** The two chat services db/seed.ts adds per language (sort 40 and 50 there), in English. */
export const DEFAULT_HELP_CHATS_EN: Help[] = [
  { name: 'Die Dargebotene Hand chat', phone: null, url: 'https://www.143.ch', hours: 'daily', audience: 'write instead of talking' },
  { name: 'Pro Juventute chat', phone: null, url: 'https://www.147.ch', hours: day, audience: 'for children and young people, also by text message' },
]

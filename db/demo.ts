/**
 * Beispielinhalte für lokale Entwicklung und Vorschau-Umgebungen – nie in Produktion ausführen.
 * Legt sechs Demo-Konten an (Passwort: «jiaia-demo-2026») und die Gedanken aus dem Entwurf.
 */
import { randomInt } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { hash } from '@node-rs/argon2'
import { db, pool } from './index'
import { circles, posts, profiles, replies, users } from './schema'

if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO !== '1') {
  console.error('Demo-Daten nicht in Produktion. (ALLOW_DEMO=1 für Vorschau-Umgebungen)')
  process.exit(1)
}

const NAMES = ['Mira', 'Jonas', 'Lea', 'Samir', 'Noa', 'Elif'] as const
type Name = (typeof NAMES)[number]
const H = 60 * 60 * 1000

const POSTS: { by: Name; anon?: boolean; circle: string; need: 'listen' | 'courage' | 'advice' | 'vent' | 'brave'; mood: number; ago: number; text: string; replies: [Name | 'anon', string][] }[] = [
  { by: 'Mira', circle: 'selbstliebe', need: 'listen', mood: 1, ago: 0.2, text: 'Ich habe heute zum ersten Mal seit Wochen in den Spiegel geschaut, ohne sofort wegzusehen. Klingt klein. War es nicht.', replies: [['Jonas', 'Das ist überhaupt nicht klein.'], ['anon', 'Ich bin stolz auf dich, auch wenn ich dich nicht kenne.']] },
  { by: 'Samir', anon: true, circle: 'depression', need: 'vent', mood: 0, ago: 0.45, text: 'Alle denken, ich sei einfach faul. Dabei kostet mich schon das Aufstehen mehr Kraft, als ich irgendwem erklären kann.', replies: [] },
  { by: 'Jonas', circle: 'angst', need: 'courage', mood: 1, ago: 1, text: 'Morgen habe ich das Gespräch mit meiner Chefin. Ich übe die Sätze seit drei Tagen. Wenn jemand einen Trick gegen das Herzrasen kennt – ich nehme alles.', replies: [['Lea', 'Länger ausatmen als einatmen. Klingt banal, hilft mir jedes Mal.']] },
  { by: 'Lea', circle: 'selbstliebe', need: 'brave', mood: 4, ago: 2, text: 'Ich habe Nein gesagt. Freundlich, klar, ohne Ausrede. Und die Welt ist nicht untergegangen.', replies: [['Mira', 'Das merke ich mir.'], ['Samir', 'Genau so.'], ['anon', 'Das will ich auch können.']] },
  { by: 'Noa', anon: true, circle: 'einsamkeit', need: 'listen', mood: 0, ago: 3, text: 'Sonntage sind am schwersten. Das Handy ist still und die Wohnung ist zu gross für eine Person.', replies: [] },
  { by: 'Samir', circle: 'burnout', need: 'advice', mood: 2, ago: 5, text: 'Wie habt ihr gemerkt, dass es zu viel wird – bevor es zu spät war? Ich glaube, ich stehe gerade genau an diesem Punkt.', replies: [] },
  { by: 'Noa', circle: 'trauer', need: 'listen', mood: 1, ago: 26, text: 'Heute wäre Omas Geburtstag gewesen. Ich habe ihren Kuchen gebacken. Er ist nicht so gut geworden wie ihrer, aber die Küche hat genauso gerochen.', replies: [['Elif', 'Was für eine schöne Art, sie bei dir zu haben.'], ['anon', 'Ich musste weinen. Danke.']] },
  { by: 'Elif', circle: 'depression', need: 'brave', mood: 3, ago: 30, text: 'Tag 14, an dem ich mich nachmittags nicht ins Bett verkrochen habe. Ich zähle nicht für euch, sondern für mich.', replies: [['Noa', 'Und wir zählen leise mit.']] },
]

async function main() {
  const pw = await hash('jiaia-demo-2026', { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 })
  const ids = {} as Record<Name, string>
  const seeds = {} as Record<Name, number>
  for (const name of NAMES) {
    const username = `demo.${name.toLowerCase()}`
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.username, username))
    if (existing) {
      console.log('Demo-Daten existieren bereits.')
      return
    }
    const [u] = await db
      .insert(users)
      .values({ username, passwordHash: pw, recoveryHash: pw, ageConfirmedAt: new Date(), rulesAcceptedAt: new Date(), createdAt: new Date(Date.now() - 40 * 24 * H), lastLoginAt: new Date() })
      .returning({ id: users.id })
    ids[name] = u!.id
    seeds[name] = randomInt(2 ** 31)
    await db.insert(profiles).values({ userId: u!.id, displayName: name, glyphSeed: seeds[name], defaultVisibility: 'pseudonym' })
  }
  const circleRows = await db.select({ id: circles.id, slug: circles.slug }).from(circles)
  for (const p of POSTS) {
    const created = new Date(Date.now() - p.ago * H)
    const othersReplies = p.replies.length
    const [post] = await db
      .insert(posts)
      .values({
        userId: ids[p.by],
        circleId: circleRows.find((c) => c.slug === p.circle)!.id,
        need: p.need,
        mood: p.mood,
        body: p.text,
        visibility: p.anon ? 'anonymous' : 'pseudonym',
        authorHandle: p.anon ? 'Anonym' : p.by,
        glyphSeed: p.anon ? randomInt(2 ** 31) : seeds[p.by],
        replyCount: othersReplies,
        createdAt: created,
      })
      .returning({ id: posts.id })
    for (const [i, [who, text]] of p.replies.entries()) {
      const author: Name = who === 'anon' ? NAMES.find((n) => n !== p.by && !p.replies.some(([w]) => w === n))! : who
      await db.insert(replies).values({
        postId: post!.id,
        userId: ids[author],
        body: text,
        authorHandle: who === 'anon' ? 'Anonym' : author,
        glyphSeed: who === 'anon' ? randomInt(2 ** 31) : seeds[author],
        createdAt: new Date(created.getTime() + (i + 1) * 7 * 60 * 1000),
      })
    }
  }
  console.log('Demo-Daten angelegt. Login z. B. «demo.mira» / «jiaia-demo-2026».')
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => pool.end())

/**
 * Erster Blogbeitrag: Jiaia ist live – im Web und als App. Legt der Seed einmal an (seed_marks «blog-launch-2026-11»);
 * danach pflegt das Team ihn im Admin-Bereich wie jeden anderen Beitrag (ändern oder löschen).
 * Nur, was es heute wirklich gibt – keine Versprechen über Funktionen, die noch kommen.
 */
export const LAUNCH_COVER_ALT: Record<'de' | 'fr' | 'it' | 'en', string> = {
  de: 'Eine Person blickt in einen Sternenhimmel, aus dem warmes Licht strömt.',
  fr: 'Une personne lève les yeux vers un ciel étoilé d’où jaillit une lumière chaude.',
  it: 'Una persona guarda un cielo stellato da cui scorre una luce calda.',
  en: 'A person looks up into a starry sky from which warm light is flowing.',
}

export const LAUNCH_POSTS: { locale: 'de' | 'fr' | 'it' | 'en'; slug: string; title: string; excerpt: string; body: string }[] = [
  {
    locale: 'de',
    slug: 'jiaia-ist-da',
    title: 'Jiaia ist da – im Web und als App',
    excerpt:
      'Ab heute ist Jiaia offen: ein ruhiger, anonymer Ort, um Gedanken zu teilen und Zuspruch zu bekommen – auf jiaia.app und als App für iPhone und iPad.',
    body: `Es gibt Gedanken, die man niemandem erzählt. Nicht, weil niemand da wäre – sondern weil der erste Satz so schwer ist, vor allem, wenn man dabei erkannt wird. Für genau diese Momente gibt es Jiaia. Ab heute ist Jiaia offen für alle in der Schweiz ab 16 Jahren: auf jiaia.app und als App für iPhone und iPad.

## Was Jiaia ist

Jiaia ist ein Ort zum Teilen und Zuhören. Du schreibst, was dich gerade beschäftigt – ganz anonym oder unter einem Namen, den du selbst wählst. Andere lesen mit und antworten. Statt Likes gibt es drei Arten von Zuspruch: «Ich höre dich», «Kenn ich» und «Du schaffst das».

Gedanken, auf die noch niemand geantwortet hat, kommen zuerst. Wer leise ist, soll nicht untergehen.

## Was wir bewusst weglassen

- Keine E-Mail-Adresse, keine Telefonnummer, kein Klarname. Ein Benutzername genügt.
- Keine Likes, keine Follower, keine Ranglisten.
- Keine Werbung und kein Tracking.
- Kein endloses Scrollen und keine Nachrichten, die dich zurückholen sollen.

## Wenn es mehr ist als ein schwerer Tag

Jiaia ersetzt keine Therapie und keine Beratung. Darum sind die Nummern der Dargebotenen Hand (143), von Pro Juventute (147) und der Notruf (144) auf jeder Seite nur einen Tipp entfernt – auch ohne Konto. Schreibst du Worte einer akuten Krise, zeigt dir Jiaia diese Hilfe sofort, und ein Mensch aus unserem Team sieht den Gedanken an, bevor er erscheint.

Für dich allein gibt es ausserdem einen Notfallplan, ein verschlüsseltes Tagebuch, eine Atemübung und die Übung 5-4-3-2-1, die dich zurück ins Hier und Jetzt holt.

## Die App

Jiaia gibt es jetzt auch im [App Store](https://apps.apple.com/ch/app/jiaia/id6829498048) – für iPhone und iPad. Du meldest dich dort mit demselben Konto an wie im Web.

## Vier Sprachen

Jiaia spricht Deutsch, Französisch, Italienisch und Englisch. Die Hilfe-Nummern und die Hinweise in einer Krise gibt es in jeder dieser Sprachen.

## Wie es weitergeht

Jiaia ist neu und wird mit den Menschen wachsen, die es nutzen. Wenn dir etwas fehlt oder etwas nicht stimmt, schreib uns an [kontakt@jiaia.app](mailto:kontakt@jiaia.app).

Schön, dass du da bist.`,
  },
  {
    locale: 'fr',
    slug: 'jiaia-est-la',
    title: 'Jiaia est là – sur le web et en application',
    excerpt:
      'Dès aujourd’hui, Jiaia est ouvert : un lieu calme et anonyme pour partager ses pensées et recevoir du soutien – sur jiaia.app et en application pour iPhone et iPad.',
    body: `Il y a des pensées qu’on ne confie à personne. Pas parce que personne n’est là – mais parce que la première phrase est si difficile, surtout quand on risque d’être reconnu·e. C’est pour ces moments-là que Jiaia existe. Dès aujourd’hui, Jiaia est ouvert à toutes et à tous en Suisse dès 16 ans : sur jiaia.app et en application pour iPhone et iPad.

## Ce qu’est Jiaia

Jiaia est un lieu pour partager et écouter. Tu écris ce qui t’occupe en ce moment – de façon entièrement anonyme ou sous un nom que tu choisis. D’autres personnes te lisent et répondent. À la place des likes, il existe trois formes de soutien : « Je t’entends », « Je connais ça » et « Tu vas y arriver ».

Les pensées qui n’ont encore reçu aucune réponse passent en premier. Les personnes discrètes ne doivent pas disparaître.

## Ce que nous laissons volontairement de côté

- Pas d’adresse e-mail, pas de numéro de téléphone, pas de vrai nom. Un nom d’utilisateur suffit.
- Pas de likes, pas d’abonné·es, pas de classements.
- Pas de publicité, pas de suivi.
- Pas de défilement sans fin, pas de notifications pour te faire revenir.

## Quand c’est plus qu’une journée difficile

Jiaia ne remplace ni une thérapie ni une consultation. C’est pourquoi les numéros de La Main Tendue (143), de Pro Juventute (147) et des urgences (144) sont à un geste sur chaque page – même sans compte. Si tu écris des mots de crise aiguë, Jiaia te montre cette aide tout de suite, et une personne de notre équipe lit la pensée avant qu’elle n’apparaisse.

Pour toi seul·e, il y a aussi un plan de crise, un journal chiffré, un exercice de respiration et l’exercice 5-4-3-2-1, qui te ramène ici et maintenant.

## L’application

Jiaia est désormais aussi dans l’[App Store](https://apps.apple.com/ch/app/jiaia/id6829498048) – pour iPhone et iPad. Tu t’y connectes avec le même compte que sur le web.

## Quatre langues

Jiaia parle allemand, français, italien et anglais. Les numéros d’aide et les messages en cas de crise existent dans chacune de ces langues.

## La suite

Jiaia est nouveau et grandira avec les personnes qui l’utilisent. S’il te manque quelque chose ou si quelque chose ne va pas, écris-nous à [kontakt@jiaia.app](mailto:kontakt@jiaia.app).

Merci d’être là.`,
  },
  {
    locale: 'it',
    slug: 'jiaia-e-qui',
    title: 'Jiaia è qui – sul web e come app',
    excerpt:
      'Da oggi Jiaia è aperto: un luogo tranquillo e anonimo per condividere pensieri e ricevere sostegno – su jiaia.app e come app per iPhone e iPad.',
    body: `Ci sono pensieri che non si raccontano a nessuno. Non perché non ci sia nessuno – ma perché la prima frase è così difficile, soprattutto se si rischia di essere riconosciuti. Jiaia esiste proprio per questi momenti. Da oggi Jiaia è aperto a tutte e tutti in Svizzera dai 16 anni: su jiaia.app e come app per iPhone e iPad.

## Che cos’è Jiaia

Jiaia è un luogo per condividere e ascoltare. Scrivi ciò che ti pesa in questo momento – in modo del tutto anonimo o con un nome che scegli tu. Altre persone leggono e rispondono. Al posto dei like ci sono tre forme di sostegno: «Ti ascolto», «So com’è» e «Ce la puoi fare».

I pensieri a cui nessuno ha ancora risposto vengono per primi. Chi parla piano non deve sparire.

## Che cosa lasciamo fuori di proposito

- Niente indirizzo e-mail, niente numero di telefono, niente nome vero. Basta un nome utente.
- Niente like, niente follower, niente classifiche.
- Niente pubblicità e niente tracciamento.
- Niente scorrimento infinito e niente notifiche per farti tornare.

## Quando è più di una giornata difficile

Jiaia non sostituisce una terapia né una consulenza. Per questo i numeri di Telefono Amico (143), di Pro Juventute (147) e dell’emergenza sanitaria (144) sono a un tocco su ogni pagina – anche senza account. Se scrivi parole di una crisi acuta, Jiaia ti mostra subito questo aiuto, e una persona del nostro team legge il pensiero prima che venga pubblicato.

Solo per te ci sono inoltre un piano di emergenza, un diario cifrato, un esercizio di respirazione e l’esercizio 5-4-3-2-1, che ti riporta al qui e ora.

## L’app

Jiaia è ora anche nell’[App Store](https://apps.apple.com/ch/app/jiaia/id6829498048) – per iPhone e iPad. Accedi con lo stesso account che usi sul web.

## Quattro lingue

Jiaia parla tedesco, francese, italiano e inglese. I numeri di aiuto e i messaggi in caso di crisi esistono in ognuna di queste lingue.

## Come andremo avanti

Jiaia è nuovo e crescerà con le persone che lo usano. Se ti manca qualcosa o qualcosa non va, scrivici a [kontakt@jiaia.app](mailto:kontakt@jiaia.app).

Che bello che tu sia qui.`,
  },
  {
    locale: 'en',
    slug: 'jiaia-is-here',
    title: 'Jiaia is here – on the web and as an app',
    excerpt:
      'From today, Jiaia is open: a calm, anonymous place to share your thoughts and receive support – on jiaia.app and as an app for iPhone and iPad.',
    body: `Some thoughts are never told to anyone. Not because nobody is there – but because the first sentence is so hard, especially when you might be recognised. Jiaia exists for exactly those moments. From today, Jiaia is open to everyone in Switzerland aged 16 and over: on jiaia.app and as an app for iPhone and iPad.

## What Jiaia is

Jiaia is a place for sharing and listening. You write what’s on your mind – fully anonymously or under a name you choose yourself. Other people read along and reply. Instead of likes, there are three kinds of support: “I hear you”, “Been there” and “You’ve got this”.

Thoughts that nobody has replied to yet come first. People who are quiet shouldn’t get lost.

## What we leave out on purpose

- No email address, no phone number, no real name. A username is enough.
- No likes, no followers, no rankings.
- No ads and no tracking.
- No endless scrolling and no notifications designed to pull you back in.

## When it’s more than a hard day

Jiaia is not a substitute for therapy or counselling. That’s why the numbers for Die Dargebotene Hand (Helping Hand, 143), Pro Juventute (147) and emergency services (144) are one tap away on every page – even without an account. If you write words of an acute crisis, Jiaia shows you this help straight away, and a person from our team looks at the thought before it appears.

Just for you, there’s also a safety plan, an encrypted journal, a breathing exercise and the 5-4-3-2-1 exercise to bring you back to the here and now.

## The app

Jiaia is now also on the [App Store](https://apps.apple.com/ch/app/jiaia/id6829498048) – for iPhone and iPad. You sign in with the same account as on the web.

## Four languages

Jiaia speaks German, French, Italian and English. The help numbers and the messages in a crisis are available in each of these languages.

## What’s next

Jiaia is new and will grow with the people who use it. If something is missing or something isn’t right, write to us at [kontakt@jiaia.app](mailto:kontakt@jiaia.app).

We’re glad you’re here.`,
  },
]

/* Jiaia Service Worker: Push für «neue Antwort» und eine Offline-Seite mit den Hilfe-Nummern. */
const CACHE = 'jiaia-v6'
/** Stylesheets und Schriften der Hilfeseiten – damit sie offline nicht ungestaltet erscheinen. */
const ASSETS = 'jiaia-assets-v2'
const OFFLINE = ['/offline', '/hilfe', '/aide', '/aiuto']
const KEEP = [CACHE, ASSETS]

let lastRefresh = 0

/** Hilfeseiten neu holen und mit ihren CSS- und Schriftdateien ablegen. Nichts Persönliches: die Seiten sind öffentlich. */
async function refreshHelp() {
  // Höchstens alle 10 Minuten – wer die Hilfe öfter öffnet, lädt nicht jedes Mal alle Seiten neu.
  if (Date.now() - lastRefresh < 10 * 60_000) return
  lastRefresh = Date.now()
  const pages = await caches.open(CACHE)
  const assets = await caches.open(ASSETS)
  const wanted = new Set()
  for (const path of OFFLINE) {
    try {
      const res = await fetch(path, { cache: 'no-store', credentials: 'omit' })
      if (!res.ok) continue
      const html = await res.clone().text()
      await pages.put(path, res)
      for (const m of html.matchAll(/(?:href|src)="(\/_next\/static\/[^"]+\.(?:css|woff2?))"/g)) wanted.add(m[1])
    } catch {}
  }
  if (!wanted.size) return
  // Schriften stehen meist nicht im HTML, sondern nur in den Stylesheets (url(../media/…woff2)) – sonst fehlten sie
  // offline, und die Hilfe erschiene in einer Ersatzschrift.
  for (const css of [...wanted].filter((u) => u.endsWith('.css'))) {
    try {
      const text = await (await fetch(css, { credentials: 'omit' })).text()
      for (const m of text.matchAll(/url\(\s*["']?([^"')]+\.woff2?)["']?\s*\)/g)) {
        const font = new URL(m[1], self.location.origin + css)
        if (font.origin === self.location.origin && font.pathname.startsWith('/_next/static/')) wanted.add(font.pathname)
      }
    } catch {}
  }
  await Promise.all([...wanted].map((u) => assets.add(u).catch(() => {})))
  // Dateien früherer Builds aufräumen.
  for (const req of await assets.keys()) if (!wanted.has(new URL(req.url).pathname)) await assets.delete(req)
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(OFFLINE))
      .then(() => refreshHelp())
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !KEEP.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // CSS und Schriften: aus dem Netz, offline aus dem Zwischenspeicher der Hilfeseiten.
  if (url.pathname.startsWith('/_next/static/') && /\.(css|woff2?)$/.test(url.pathname)) {
    event.respondWith(fetch(req).catch(async () => (await caches.match(req, { cacheName: ASSETS })) || Response.error()))
    return
  }

  // Nur Seitenaufrufe: bei Netzfehler die zwischengespeicherte Hilfe zeigen. Nichts Persönliches wird gecacht.
  if (req.mode !== 'navigate') return
  const help = OFFLINE.includes(url.pathname)
  event.respondWith(
    fetch(req)
      .then((res) => {
        // Hilfeseite online geöffnet: die Offline-Kopie gleich mit auffrischen (geänderte Nummern im Admin).
        if (help && res.ok) event.waitUntil(refreshHelp())
        return res
      })
      .catch(async () => {
        const cache = await caches.open(CACHE)
        const page = ['/hilfe', '/aide', '/aiuto'].includes(url.pathname) ? url.pathname : '/offline'
        return (await cache.match(page)) || Response.error()
      }),
  )
})

self.addEventListener('push', (event) => {
  let data = { title: 'Jiaia', body: 'Jemand hat dir geantwortet', url: '/start' }
  try {
    data = { ...data, ...event.data.json() }
  } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      // Eigener Tag für Krisen-Hinweise an die Moderation: ersetzt keine Antwort-Meldung und bleibt stehen.
      tag: data.tag || 'lichtung-reply',
      requireInteraction: data.tag === 'lichtung-acute',
      renotify: data.tag === 'lichtung-acute',
      data: { url: data.url },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/start'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (list) => {
      for (const c of list) {
        if (!('focus' in c)) continue
        // navigate() geht nur bei Fenstern, die dieser Service Worker steuert – sonst ein neues Fenster öffnen.
        try {
          const target = await c.navigate(url)
          return (target || c).focus()
        } catch {
          break
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})

/* Lichtung Service Worker: Push für «neue Antwort» und eine Offline-Seite mit den Hilfe-Nummern. */
const CACHE = 'lichtung-v1'
const OFFLINE = ['/offline', '/hilfe']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(OFFLINE)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

// Nur Seitenaufrufe: bei Netzfehler die zwischengespeicherte Hilfe zeigen. Nichts Persönliches wird gecacht.
self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.mode !== 'navigate') return
  event.respondWith(
    fetch(req).catch(async () => {
      const cache = await caches.open(CACHE)
      const url = new URL(req.url)
      return (await cache.match(url.pathname === '/hilfe' ? '/hilfe' : '/offline')) || Response.error()
    }),
  )
})

self.addEventListener('push', (event) => {
  let data = { title: 'Lichtung', body: 'Jemand hat dir geantwortet', url: '/lichtung' }
  try {
    data = { ...data, ...event.data.json() }
  } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: 'lichtung-reply',
      data: { url: data.url },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/lichtung'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) {
          c.navigate(url)
          return c.focus()
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})

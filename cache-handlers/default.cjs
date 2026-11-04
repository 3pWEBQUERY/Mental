// @ts-check
/**
 * Cache für 'use cache' – der eingebaute Speicher-Cache von Next, plus Abgleich zwischen den Web-Replikas.
 *
 * Jede Replika hat ihren eigenen Cache. updateTag() (z. B. nach einer Admin-Änderung an Kreisen, Hilfe-Nummern
 * oder Krisenbegriffen) wirkt eingebaut nur auf der Replika, die die Änderung speichert. Hier geht jede
 * Invalidierung zusätzlich per Postgres NOTIFY an alle anderen. Die markieren dieselben Tags sofort als
 * abgelaufen. Das gilt auch für vorgerenderte Seiten wie /hilfe, denn Next führt die Tag-Zeitstempel für
 * beide Caches in derselben Liste (tags-manifest).
 *
 * Bricht die Verbindung ab, kann eine Nachricht verloren gehen. Darum laufen nach dem Wiederverbinden alle
 * Tags ab, die diese Replika im Cache hat. Ohne Datenbank (Build, lokale Skripte) bleibt es beim eingebauten Cache.
 */
const { randomUUID } = require('node:crypto')
const { createDefaultCacheHandler } = require('next/dist/server/lib/cache-handlers/default')

const CHANNEL = 'jiaia_cache_tags'
const ME = randomUUID()
const local = createDefaultCacheHandler(50 * 1024 * 1024)
/** Tags, die in diesem Prozess vorkommen – für das Nachholen nach einem Verbindungsabbruch. */
const seen = new Set()

/** @type {import('pg').Client | null} */
let client = null
let connecting = false
let attempt = 0
let everConnected = false
/** Erster Verbindungsversuch gescheitert – dann auch beim ersten Erfolg nachholen. */
let firstFailed = false

const enabled = () => Boolean(process.env.DATABASE_URL) && process.env.NEXT_PHASE !== 'phase-production-build'

/** @param {unknown} e */
const why = (e) => String(e instanceof Error ? e.message : e).slice(0, 160)

function connect() {
  if (!enabled() || client || connecting) return
  connecting = true
  const { Client } = require('pg')
  // keepAlive + Ping: Eine still abgebrochene Verbindung meldete sonst nie einen Fehler – Invalidierungen kämen
  // nicht mehr an, und das Senden (broadcast) hinge. query_timeout begrenzt jede Abfrage.
  const c = new Client({ connectionString: process.env.DATABASE_URL, keepAlive: true, query_timeout: 5_000, connectionTimeoutMillis: 10_000 })
  let gone = false
  /** @type {ReturnType<typeof setInterval> | undefined} */
  let ping
  /** @param {string} reason */
  const lost = (reason) => {
    if (gone) return
    gone = true
    clearInterval(ping)
    if (client === c) client = null
    connecting = false
    c.end().catch(() => {})
    if (!everConnected) firstFailed = true
    console.error('[cache] Abgleich unterbrochen:', reason)
    const t = setTimeout(connect, Math.min(30_000, 1_000 * 2 ** attempt++))
    t.unref?.()
  }
  c.on('error', (e) => lost(why(e)))
  c.on('end', () => lost('beendet'))
  c.on('notification', (msg) => {
    try {
      const { from, tags, expire } = JSON.parse(msg.payload ?? '{}')
      if (from === ME || !Array.isArray(tags)) return
      const list = tags.filter((t) => typeof t === 'string')
      void local.updateTags(list, typeof expire === 'number' ? { expire } : undefined)
    } catch {}
  })
  c.connect()
    .then(() => c.query(`LISTEN ${CHANNEL}`))
    .then(
      () => {
        client = c
        connecting = false
        const hadGap = everConnected || firstFailed
        attempt = 0
        ping = setInterval(() => void c.query('SELECT 1').catch((e) => lost(why(e))), 60_000)
        ping.unref?.()
        // Während der Lücke könnte eine Invalidierung verpasst worden sein: lieber einmal neu laden.
        // Auch beim ersten Verbinden, falls es zuerst scheiterte und schon etwas im Cache liegt.
        if (seen.size && hadGap) void local.updateTags([...seen])
        everConnected = true
      },
      (e) => lost(why(e)),
    )
}

/** Einmalige eigene Verbindung – wenn die dauerhafte gerade weg ist oder beim Senden versagt. @param {string} payload */
async function sendOnce(payload) {
  const { Client } = require('pg')
  const once = new Client({ connectionString: process.env.DATABASE_URL, query_timeout: 5_000, connectionTimeoutMillis: 5_000 })
  await once.connect()
  try {
    await once.query('SELECT pg_notify($1, $2)', [CHANNEL, payload])
  } finally {
    await once.end().catch(() => {})
  }
}

/** @param {string[]} tags @param {{ expire?: number } | undefined} durations */
async function broadcast(tags, durations) {
  if (!enabled() || !tags.length) return
  const payload = JSON.stringify({ from: ME, tags, expire: durations?.expire })
  // NOTIFY erlaubt knapp 8000 Byte: zu viele Tags in Gruppen aufteilen statt still zu verwerfen.
  if (payload.length > 7900) {
    const half = Math.ceil(tags.length / 2)
    if (tags.length < 2) return console.error('[cache] Invalidierung zu gross, nicht verteilt:', tags[0]?.slice(0, 80))
    await broadcast(tags.slice(0, half), durations)
    await broadcast(tags.slice(half), durations)
    return
  }
  const c = client
  if (c) {
    try {
      await c.query('SELECT pg_notify($1, $2)', [CHANNEL, payload])
      return
    } catch (e) {
      // Halbtote Verbindung: sie als verloren markieren (Neuaufbau + Nachholen) und über eine frische senden.
      console.error('[cache] Senden über die feste Verbindung fehlgeschlagen:', why(e))
      c.emit('error', e)
    }
  }
  for (let i = 0; i < 2; i++) {
    try {
      return await sendOnce(payload)
    } catch (e) {
      if (i === 1) console.error('[cache] Invalidierung nicht verteilt:', why(e))
      else await new Promise((r) => setTimeout(r, 300))
    }
  }
}

connect()

/** @type {import('next/cache').CacheHandler} */
const handler = {
  get: (key, softTags) => local.get(key, softTags),
  set(key, pending) {
    pending.then((entry) => entry.tags.forEach((t) => seen.add(t)), () => {})
    return local.set(key, pending)
  },
  refreshTags: () => local.refreshTags(),
  getExpiration: (tags) => local.getExpiration(tags),
  async updateTags(tags, durations) {
    await local.updateTags(tags, durations)
    await broadcast(tags, durations)
  },
}

module.exports = handler

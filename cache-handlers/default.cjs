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

const enabled = () => Boolean(process.env.DATABASE_URL) && process.env.NEXT_PHASE !== 'phase-production-build'

/** @param {unknown} e */
const why = (e) => String(e instanceof Error ? e.message : e).slice(0, 160)

function connect() {
  if (!enabled() || client || connecting) return
  connecting = true
  const { Client } = require('pg')
  const c = new Client({ connectionString: process.env.DATABASE_URL })
  let gone = false
  /** @param {string} reason */
  const lost = (reason) => {
    if (gone) return
    gone = true
    if (client === c) client = null
    connecting = false
    c.end().catch(() => {})
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
        attempt = 0
        // Während der Lücke könnte eine Invalidierung verpasst worden sein: lieber einmal neu laden.
        if (everConnected && seen.size) void local.updateTags([...seen])
        everConnected = true
      },
      (e) => lost(why(e)),
    )
}

/** @param {string[]} tags @param {{ expire?: number } | undefined} durations */
async function broadcast(tags, durations) {
  if (!enabled() || !tags.length) return
  const payload = JSON.stringify({ from: ME, tags, expire: durations?.expire })
  if (payload.length > 7900) return
  try {
    if (client) {
      await client.query('SELECT pg_notify($1, $2)', [CHANNEL, payload])
      return
    }
    // Eigene Verbindung gerade weg: einmalig senden, damit die anderen es trotzdem erfahren.
    const { Client } = require('pg')
    const once = new Client({ connectionString: process.env.DATABASE_URL })
    await once.connect()
    try {
      await once.query('SELECT pg_notify($1, $2)', [CHANNEL, payload])
    } finally {
      await once.end().catch(() => {})
    }
  } catch (e) {
    console.error('[cache] Invalidierung nicht verteilt:', why(e))
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

import 'server-only'
import { Client } from 'pg'
import { NOTIFY_CHANNEL } from './notify'
import { safeMessage } from '../log-safe'

type Listener = () => void
type Hub = { subs: Map<string, Set<Listener>>; client: Client | null; connecting: boolean; attempt: number }

declare global {
  var __lichtungListener: Hub | undefined
}

/**
 * Eine LISTEN-Verbindung pro Prozess. Die Nutzlast ist die user_id und verlässt den Server nie.
 * Bricht die Verbindung ab, bleiben die Abos bestehen und die Verbindung wird mit wachsendem Abstand
 * neu aufgebaut – sonst verstummte die Glocke für alle offenen Tabs, ohne dass es jemand merkt.
 */
function hub(): Hub {
  if (!globalThis.__lichtungListener) {
    globalThis.__lichtungListener = { subs: new Map(), client: null, connecting: false, attempt: 0 }
    void connect(globalThis.__lichtungListener)
  }
  return globalThis.__lichtungListener
}

async function connect(h: Hub) {
  if (h.client || h.connecting) return
  h.connecting = true
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  let gone = false
  const lost = (why: string) => {
    if (gone) return
    gone = true
    console.error('[listener] Verbindung verloren:', why)
    if (h.client === client) h.client = null
    h.connecting = false
    client.end().catch(() => {})
    const delay = Math.min(30_000, 1_000 * 2 ** h.attempt++)
    setTimeout(() => void connect(h), delay).unref?.()
  }
  client.on('error', (e) => lost(e.message))
  client.on('end', () => lost('beendet'))
  client.on('notification', (msg) => h.subs.get(msg.payload ?? '')?.forEach((fn) => fn()))
  try {
    await client.connect()
    await client.query(`LISTEN ${NOTIFY_CHANNEL}`)
  } catch (e) {
    return lost(safeMessage(e))
  }
  const reconnected = h.attempt > 0
  h.client = client
  h.connecting = false
  h.attempt = 0
  // Während der Lücke kann ein NOTIFY verloren gegangen sein: alle offenen Glocken einmal auffrischen.
  if (reconnected) h.subs.forEach((set) => set.forEach((fn) => fn()))
}

export async function subscribe(userId: string, fn: Listener) {
  const h = hub()
  let set = h.subs.get(userId)
  if (!set) h.subs.set(userId, (set = new Set()))
  set.add(fn)
  return () => {
    set.delete(fn)
    if (!set.size) h.subs.delete(userId)
  }
}

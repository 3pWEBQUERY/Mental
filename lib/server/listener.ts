import 'server-only'
import { Client } from 'pg'
import { NOTIFY_CHANNEL } from './notify'

type Listener = () => void

declare global {
  var __lichtungListener: { client: Promise<Client>; subs: Map<string, Set<Listener>> } | undefined
}

/** Eine LISTEN-Verbindung pro Prozess. Die Nutzlast ist die user_id und verlässt den Server nie. */
function hub() {
  globalThis.__lichtungListener ??= {
    subs: new Map(),
    client: (async () => {
      const client = new Client({ connectionString: process.env.DATABASE_URL })
      await client.connect()
      await client.query(`LISTEN ${NOTIFY_CHANNEL}`)
      client.on('notification', (msg) => {
        globalThis.__lichtungListener?.subs.get(msg.payload ?? '')?.forEach((fn) => fn())
      })
      client.on('error', (e) => {
        console.error('[listener]', e.message)
        globalThis.__lichtungListener = undefined
      })
      return client
    })(),
  }
  return globalThis.__lichtungListener
}

export async function subscribe(userId: string, fn: Listener) {
  const h = hub()
  await h.client
  let set = h.subs.get(userId)
  if (!set) h.subs.set(userId, (set = new Set()))
  set.add(fn)
  return () => {
    set.delete(fn)
    if (!set.size) h.subs.delete(userId)
  }
}

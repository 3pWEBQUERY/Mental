import { and, count, eq, isNull, sql } from 'drizzle-orm'
import { db } from '@/db'
import { notifications } from '@/db/schema'
import { subscribe } from '@/lib/server/listener'
import { getViewer } from '@/lib/server/session'
import { takeSlot } from '@/lib/server/sse-slots'

/**
 * Server-Sent Events für die Glocke, solange die App offen ist.
 * Ein gemeinsamer LISTEN-Client pro Replika verteilt Postgres-NOTIFY an alle offenen Verbindungen.
 */
export async function GET(request: Request) {
  const v = await getViewer()
  if (!v) return new Response(null, { status: 401 })
  const userId = v.userId
  const enc = new TextEncoder()
  let cleanup = () => {}
  let evicted = false
  // Verdrängt von einem neueren Tab desselben Kontos: «bye» – der Tab verbindet sich erst wieder im Vordergrund.
  const release = takeSlot(userId, () => {
    evicted = true
    cleanup()
  })
  if (!release) return new Response(null, { status: 503, headers: { 'Retry-After': '30' } })

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      const push = async () => {
        const [r] = await db
          .select({ n: count(), support: sql<boolean>`bool_or(${notifications.kind} = 'support')` })
          .from(notifications)
          .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
        send('notification', { unread: r?.n ?? 0, support: Boolean(r?.support) })
      }
      controller.enqueue(enc.encode('retry: 15000\n\n'))
      const unsubscribe = await subscribe(userId, () => void push().catch(() => {}))
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(enc.encode(': ping\n\n'))
        } catch {
          cleanup()
        }
      }, 25_000)
      let closed = false
      cleanup = () => {
        if (closed) return
        closed = true
        clearInterval(heartbeat)
        unsubscribe()
        release()
        try {
          if (evicted) controller.enqueue(enc.encode('event: bye\ndata: {}\n\n'))
          controller.close()
        } catch {}
      }
      request.signal.addEventListener('abort', () => cleanup())
      // Schon verdrängt oder abgebrochen, während wir auf LISTEN gewartet haben.
      if (evicted || request.signal.aborted) cleanup()
    },
    cancel() {
      cleanup()
    },
  })
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' },
  })
}

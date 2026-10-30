import { and, eq, isNull } from 'drizzle-orm'
import { db } from '@/db'
import { notifications } from '@/db/schema'
import { subscribe } from '@/lib/server/listener'
import { getViewer } from '@/lib/server/session'

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

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      const push = async () => {
        const rows = await db
          .select({ kind: notifications.kind })
          .from(notifications)
          .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
        send('notification', { unread: rows.length, support: rows.some((r) => r.kind === 'support') })
      }
      controller.enqueue(enc.encode('retry: 15000\n\n'))
      const unsubscribe = await subscribe(userId, () => void push().catch(() => {}))
      const heartbeat = setInterval(() => controller.enqueue(enc.encode(': ping\n\n')), 25_000)
      cleanup = () => {
        clearInterval(heartbeat)
        unsubscribe()
        try {
          controller.close()
        } catch {}
      }
      request.signal.addEventListener('abort', () => cleanup())
    },
    cancel() {
      cleanup()
    },
  })
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' },
  })
}

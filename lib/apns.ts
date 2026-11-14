import { createPrivateKey, sign, type KeyObject } from 'node:crypto'
import http2 from 'node:http2'

/**
 * Mitteilungen an die iOS-App über Apple (APNs, HTTP/2 mit Token-Anmeldung) – ohne zusätzliche Bibliothek.
 *
 * Variablen (nur im Worker nötig):
 * - APNS_KEY_ID: Schlüssel-ID des «Apple Push Notifications service (APNs)»-Schlüssels (10 Zeichen)
 * - APNS_TEAM_ID: Team-ID (z. B. CY2659G6Q3)
 * - APNS_PRIVATE_KEY: Inhalt der .p8-Datei (Zeilenumbrüche dürfen als \n stehen)
 * - APNS_TOPIC: Bundle-ID der App (Standard app.jiaia)
 * Fehlt etwas, sendet der Worker nur Web-Push.
 */

export type ApnsMessage = {
  title: string
  body: string
  /** Pfad in der App (wie im Web), z. B. /start/gedanke/<id> – die App öffnet daraus den Gedanken. */
  url: string
  /** Gleiche Mitteilungen gruppiert iOS (z. B. alle Antworten zu einem Gedanken). */
  thread?: string
  urgent?: boolean
  /** Sekunden, die Apple eine nicht zustellbare Mitteilung aufbewahrt. */
  ttl: number
}

type Config = { keyId: string; teamId: string; key: KeyObject; topic: string }

let config: Config | null | undefined

export function apnsConfig(): Config | null {
  if (config !== undefined) return config
  const keyId = process.env.APNS_KEY_ID?.trim()
  const teamId = process.env.APNS_TEAM_ID?.trim()
  const pem = process.env.APNS_PRIVATE_KEY?.replace(/\\n/g, '\n').trim()
  if (!keyId || !teamId || !pem) return (config = null)
  try {
    config = { keyId, teamId, key: createPrivateKey(pem), topic: process.env.APNS_TOPIC?.trim() || 'app.jiaia' }
  } catch {
    console.error('[apns] APNS_PRIVATE_KEY ist kein gültiger Schlüssel (.p8)')
    config = null
  }
  return config
}

const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64url')

/** Anmelde-Token für Apple (ES256). Apple verlangt einen neuen höchstens jede Stunde – wir erneuern nach 50 Minuten. */
export function providerToken(c: Pick<Config, 'keyId' | 'teamId' | 'key'>, now = Date.now()): string {
  const header = b64url(JSON.stringify({ alg: 'ES256', kid: c.keyId }))
  const claims = b64url(JSON.stringify({ iss: c.teamId, iat: Math.floor(now / 1000) }))
  const signature = sign('sha256', Buffer.from(`${header}.${claims}`), { key: c.key, dsaEncoding: 'ieee-p1363' })
  return `${header}.${claims}.${b64url(signature)}`
}

let cached: { token: string; at: number } | null = null
function bearer(c: Config) {
  const now = Date.now()
  if (!cached || now - cached.at > 50 * 60 * 1000) cached = { token: providerToken(c, now), at: now }
  return cached.token
}

/** Inhalt der Mitteilung: neutraler Text, `url` für die App. Nie Inhalte aus Gedanken. */
export function apnsPayload(m: ApnsMessage) {
  return {
    aps: {
      alert: { title: m.title, body: m.body },
      sound: 'default',
      ...(m.thread ? { 'thread-id': m.thread } : {}),
    },
    url: m.url,
  }
}

/** Gültige Geräte-Tokens sind Hex (heute 64 Zeichen, Apple behält sich längere vor). */
export const isApnsToken = (t: unknown): t is string => typeof t === 'string' && /^[0-9a-f]{64,200}$/i.test(t)

const sessions = new Map<string, http2.ClientHttp2Session>()

function connect(sandbox: boolean) {
  const host = sandbox ? 'https://api.sandbox.push.apple.com' : 'https://api.push.apple.com'
  const existing = sessions.get(host)
  if (existing && !existing.closed && !existing.destroyed) return existing
  const s = http2.connect(host)
  s.on('error', () => sessions.delete(host))
  s.on('close', () => sessions.delete(host))
  // Eine Minute ohne Mitteilung: Verbindung schliessen (Apple trennt ruhende Verbindungen ohnehin).
  s.setTimeout(60_000, () => s.close())
  sessions.set(host, s)
  return s
}

/**
 * Sendet eine Mitteilung. Ergebnis: 'sent', 'gone' (Token ungültig oder App gelöscht – Gerät entfernen)
 * oder 'failed' (später wieder versuchen ist nicht nötig; die Glocke zeigt die Antwort ohnehin).
 */
export async function sendApns(token: string, sandbox: boolean, m: ApnsMessage): Promise<'sent' | 'gone' | 'failed'> {
  const c = apnsConfig()
  if (!c || !isApnsToken(token)) return 'failed'
  const body = JSON.stringify(apnsPayload(m))
  return new Promise((resolve) => {
    let req: http2.ClientHttp2Stream
    try {
      req = connect(sandbox).request({
        ':method': 'POST',
        ':path': `/3/device/${token}`,
        authorization: `bearer ${bearer(c)}`,
        'apns-topic': c.topic,
        'apns-push-type': 'alert',
        'apns-priority': m.urgent ? '10' : '5',
        'apns-expiration': String(Math.floor(Date.now() / 1000) + m.ttl),
        'content-type': 'application/json',
      })
    } catch (e) {
      console.error('[apns] Verbindung', (e as Error).message)
      return resolve('failed')
    }
    let status = 0
    let data = ''
    req.setEncoding('utf8')
    req.setTimeout(10_000, () => req.close(http2.constants.NGHTTP2_CANCEL))
    req.on('response', (h) => (status = Number(h[':status'])))
    req.on('data', (d: string) => (data += d))
    req.on('error', () => resolve('failed'))
    req.on('close', () => {
      if (status === 200) return resolve('sent')
      const reason = (() => {
        try {
          return (JSON.parse(data) as { reason?: string }).reason ?? ''
        } catch {
          return ''
        }
      })()
      if (status === 410 || reason === 'BadDeviceToken' || reason === 'Unregistered' || reason === 'DeviceTokenNotForTopic') return resolve('gone')
      if (status) console.error('[apns]', status, reason)
      resolve('failed')
    })
    req.end(body)
  })
}

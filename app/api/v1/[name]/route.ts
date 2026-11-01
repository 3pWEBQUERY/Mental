import { connection } from 'next/server'
import * as app from '@/app/(app)/actions'
import * as me from '@/app/(app)/(raum)/ich/actions'
import * as settings from '@/app/(app)/einstellungen/actions'
import * as auth from '@/app/(auth)/actions'
import { apiContext, appLocale, bearerToken } from '@/lib/server/api-context'
import * as mobile from '@/lib/server/mobile'
import { destroySession, getViewer } from '@/lib/server/session'
import { safeMessage } from '@/lib/log-safe'

/**
 * Schnittstelle für die Apps: POST /api/v1/<name> mit { "args": [...] } ruft dieselbe Server Action auf wie
 * die Web-App – mit denselben Prüfungen, Grenzen und Texten. Es gibt nur die Aufrufe in dieser Liste.
 * Die Sitzung kommt als «Authorization: Bearer <token>»; Cookies zählen hier nie (lib/server/api-context.ts).
 * Antwort: { "result": … } und nach Anmeldung, Registrierung oder Wiederherstellung zusätzlich { "token": … }.
 */
type Call = (...args: never[]) => Promise<unknown>

const CALLS: Record<string, Call> = {
  // Konto (ohne Sitzung)
  checkUsername: auth.checkUsername,
  checkPassword: auth.checkPassword,
  prepareRecoveryKey: auth.prepareRecoveryKey,
  register: auth.register,
  setInitialDisplayName: auth.setInitialDisplayName,
  login: auth.login,
  recover: auth.recover,
  logout: async () => {
    await destroySession()
    return { ok: true }
  },

  // Lesen
  me: mobile.me,
  feed: mobile.feed,
  post: mobile.post,
  myPosts: mobile.myPosts,
  bookmarks: mobile.bookmarks,
  history: mobile.history,
  saved: mobile.saved,
  nextWaiting: app.nextWaiting,
  currentStep: app.currentStep,
  listNotifications: app.listNotifications,
  unreadState: app.unreadState,
  presenceCounts: app.presenceCounts,

  // Gedanken und Antworten
  createPost: app.createPost,
  updatePost: app.updatePost,
  deletePost: app.deletePost,
  setClosed: app.setClosed,
  toggleSupport: app.toggleSupport,
  createReply: app.createReply,
  markHelpful: app.markHelpful,
  hideReply: app.hideReply,
  deleteReply: app.deleteReply,
  toggleBookmark: app.toggleBookmark,
  reportContent: app.reportContent,
  blockAuthor: app.blockAuthor,
  setCirclePref: app.setCirclePref,
  touchCircle: app.touchCircle,
  markNotificationsRead: app.markNotificationsRead,
  appeal: app.appeal,

  // Raum
  saveCheckin: app.saveCheckin,
  logBreath: app.logBreath,
  stepAction: app.stepAction,

  // Für mich
  journalState: me.journalState,
  setupJournal: me.setupJournal,
  listJournal: me.listJournal,
  addJournalEntry: me.addJournalEntry,
  deleteJournalEntry: me.deleteJournalEntry,
  getSafetyPlan: me.getSafetyPlan,
  saveSafetyPlan: me.saveSafetyPlan,
  myLetters: me.myLetters,
  writeLetter: me.writeLetter,
  deleteLetter: me.deleteLetter,

  // Einstellungen
  updateIdentity: settings.updateIdentity,
  updateSettings: settings.updateSettings,
  finishOnboarding: settings.finishOnboarding,
  changePassword: settings.changePassword,
  regenerateRecoveryKey: settings.regenerateRecoveryKey,
  listSessions: settings.listSessions,
  endSession: settings.endSession,
  listBlocked: settings.listBlocked,
  unblock: settings.unblock,
  requestExport: settings.requestExport,
  exportStatus: settings.exportStatus,
  deleteAccount: settings.deleteAccount,
}

const MAX_BODY = 64 * 1024

/** Aufrufe, die ohne Sitzung gehen – hier darf ein altes Token mitkommen, ohne dass es 401 gibt. */
const SESSIONLESS = new Set(['checkUsername', 'checkPassword', 'prepareRecoveryKey', 'register', 'setInitialDisplayName', 'login', 'recover', 'logout'])

export async function POST(request: Request, { params }: { params: Promise<{ name: string }> }) {
  await connection()
  const { name } = await params
  const call = Object.hasOwn(CALLS, name) ? CALLS[name] : undefined
  if (!call) return Response.json({ error: 'unknown' }, { status: 404 })
  // Nur JSON: Ein Formular einer fremden Seite kann diesen Content-Type nicht ohne CORS-Vorabprüfung senden.
  if (!request.headers.get('content-type')?.startsWith('application/json')) return Response.json({ error: 'json' }, { status: 415 })
  const text = await request.text()
  if (text.length > MAX_BODY) return Response.json({ error: 'too large' }, { status: 413 })
  let args: unknown[] = []
  try {
    const body = text ? (JSON.parse(text) as { args?: unknown }) : {}
    if (body.args !== undefined) {
      if (!Array.isArray(body.args) || body.args.length > 4) throw new Error()
      args = body.args
    }
  } catch {
    return Response.json({ error: 'bad request' }, { status: 400 })
  }
  try {
    const hasBearer = bearerToken(request.headers) !== null
    const { result, token } = await apiContext.run(async () => {
      // Abgelaufene oder anderswo beendete Sitzung: einheitlich 401, damit die App sofort abmeldet und keine
      // zwischengespeicherten Inhalte weiter zeigt (die Actions selbst liefern sonst nur null oder []).
      if (hasBearer && !SESSIONLESS.has(name) && !(await getViewer())) throw new Error('unauthorized')
      return call(...(args as never[]))
    }, appLocale(request.headers))
    return Response.json(token ? { result: result ?? null, token } : { result: result ?? null }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    // Ohne gültige Sitzung «unauthorized» – für die App heisst das: neu anmelden.
    if (e instanceof Error && e.message === 'unauthorized') return Response.json({ error: 'unauthorized' }, { status: 401 })
    console.error(`[api/v1/${name}]`, safeMessage(e))
    return Response.json({ error: 'server' }, { status: 500 })
  }
}

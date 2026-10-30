import { sql } from 'drizzle-orm'
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { uuidv7 } from '../lib/id'

const citext = customType<{ data: string }>({ dataType: () => 'citext' })
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' })
const id = () => uuid('id').primaryKey().$defaultFn(uuidv7)
const createdAt = () => ts('created_at').notNull().defaultNow()

/* ---------------------------------------------------------------- Enums */

export const roleEnum = pgEnum('role', ['member', 'peer_mod', 'mod', 'admin'])
export const userStatusEnum = pgEnum('user_status', ['active', 'muted', 'banned', 'deleting'])
export const visibilityEnum = pgEnum('visibility', ['anonymous', 'pseudonym'])
export const needEnum = pgEnum('need', ['listen', 'courage', 'advice', 'vent', 'brave'])
export const contentStatusEnum = pgEnum('content_status', ['pending', 'visible', 'hidden', 'removed'])
export const crisisLevelEnum = pgEnum('crisis_level', ['none', 'concern', 'acute'])
export const supportKindEnum = pgEnum('support_kind', ['hear', 'same', 'strong'])
export const circlePrefEnum = pgEnum('circle_pref', ['follow', 'mute'])
export const mediaStatusEnum = pgEnum('media_status', ['quarantine', 'ready', 'rejected'])
export const notificationKindEnum = pgEnum('notification_kind', ['reply', 'support', 'moderation'])
export const targetTypeEnum = pgEnum('target_type', ['post', 'reply', 'user'])
export const reportReasonEnum = pgEnum('report_reason', [
  'worry',
  'hurtful',
  'spam',
  'personal_data',
  'other',
  'auto_acute',
  'auto_flag',
])
export const reportStatusEnum = pgEnum('report_status', ['open', 'resolved', 'dismissed'])
export const stepActionEnum = pgEnum('step_action', ['done', 'skip'])
export const crisisTermLevelEnum = pgEnum('crisis_term_level', ['concern', 'acute'])
export const exportStatusEnum = pgEnum('export_status', ['pending', 'ready', 'failed'])

/* ---------------------------------------------------- Konto & Sitzungen */

/** Login-Daten. Keine E-Mail, kein Geburtsdatum, keine IP. */
export const users = pgTable('users', {
  id: id(),
  username: citext('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  recoveryHash: text('recovery_hash').notNull(),
  role: roleEnum('role').notNull().default('member'),
  status: userStatusEnum('status').notNull().default('active'),
  mutedUntil: ts('muted_until'),
  ageConfirmedAt: ts('age_confirmed_at').notNull(),
  rulesAcceptedAt: ts('rules_accepted_at').notNull(),
  createdAt: createdAt(),
  lastLoginAt: ts('last_login_at'),
  deleteAfter: ts('delete_after'),
})

export const passkeys = pgTable(
  'passkeys',
  {
    id: id(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    credentialId: text('credential_id').notNull().unique(),
    publicKey: text('public_key').notNull(),
    counter: integer('counter').notNull().default(0),
    deviceType: text('device_type').notNull(),
    backedUp: boolean('backed_up').notNull().default(false),
    transports: text('transports').array(),
    label: text('label'),
    createdAt: createdAt(),
    lastUsedAt: ts('last_used_at'),
  },
  (t) => [index('passkeys_user_idx').on(t.userId)],
)

/** Kein Klartext-Token, keine IP. */
export const sessions = pgTable(
  'sessions',
  {
    id: id(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    deviceLabel: text('device_label').notNull(),
    authMethod: text('auth_method', { enum: ['password', 'passkey', 'recovery'] }).notNull(),
    expiresAt: ts('expires_at').notNull(),
    createdAt: createdAt(),
    lastSeenAt: ts('last_seen_at').notNull().defaultNow(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
)

/** Gesperrte oder gelöschte Benutzernamen bleiben 90 Tage reserviert. */
export const reservedUsernames = pgTable('reserved_usernames', {
  username: citext('username').primaryKey(),
  until: ts('until').notNull(),
})

export type Settings = {
  theme?: 'system' | 'light' | 'dark'
  fontSize?: 'normal' | 'large' | 'xlarge'
  motion?: 'on' | 'reduced' | 'off'
  breathSound?: boolean
  hidePresence?: boolean
  collapseWarnings?: boolean
  journalSalt?: string
  journalCheck?: { iv: string; ciphertext: string; salt: string }
  proHelpHintAt?: string
}

/** Öffentliche Seite eines Kontos – der Anzeigename ist nicht unique. */
export const profiles = pgTable('profiles', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  displayName: text('display_name').notNull(),
  defaultVisibility: visibilityEnum('default_visibility').notNull().default('anonymous'),
  glyphSeed: integer('glyph_seed').notNull(),
  settings: jsonb('settings').$type<Settings>().notNull().default({}),
})

/* --------------------------------------------------------------- Kreise */

export const circles = pgTable('circles', {
  id: id(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  rules: text('rules').notNull(),
  color: text('color').notNull(),
  sort: integer('sort').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
})

export const circlePrefs = pgTable(
  'circle_prefs',
  {
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    circleId: uuid('circle_id').notNull().references(() => circles.id, { onDelete: 'cascade' }),
    state: circlePrefEnum('state').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.circleId] })],
)

/** "Gerade hier": wer in den letzten 15 Minuten im Kreis aktiv war. Wird stündlich geleert. */
export const circlePresence = pgTable(
  'circle_presence',
  {
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    circleId: uuid('circle_id').notNull().references(() => circles.id, { onDelete: 'cascade' }),
    seenAt: ts('seen_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.circleId] }), index('presence_circle_idx').on(t.circleId, t.seenAt)],
)

/* ------------------------------------------------------------ Gedanken */

export const posts = pgTable(
  'posts',
  {
    id: id(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    circleId: uuid('circle_id').notNull().references(() => circles.id),
    need: needEnum('need').notNull(),
    mood: smallint('mood').notNull(),
    body: text('body').notNull(),
    visibility: visibilityEnum('visibility').notNull(),
    authorHandle: text('author_handle').notNull(),
    glyphSeed: integer('glyph_seed').notNull(),
    contentWarning: boolean('content_warning').notNull().default(false),
    status: contentStatusEnum('status').notNull().default('visible'),
    crisisLevel: crisisLevelEnum('crisis_level').notNull().default('none'),
    moderationNote: text('moderation_note'),
    replyCount: integer('reply_count').notNull().default(0),
    closed: boolean('closed').notNull().default(false),
    editedAt: ts('edited_at'),
    createdAt: createdAt(),
    deletedAt: ts('deleted_at'),
  },
  (t) => [
    index('posts_status_created_idx').on(t.status, t.createdAt.desc()),
    index('posts_unheard_idx')
      .on(t.replyCount, t.createdAt)
      .where(sql`status = 'visible' AND reply_count = 0`),
    index('posts_circle_created_idx').on(t.circleId, t.createdAt.desc()),
    index('posts_user_idx').on(t.userId, t.createdAt.desc()),
  ],
)

/** Nur Schlüssel im Bucket, nie öffentliche URLs. */
export const postMedia = pgTable(
  'post_media',
  {
    id: id(),
    postId: uuid('post_id').references(() => posts.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    bucketKey: text('bucket_key').notNull(),
    contentType: text('content_type').notNull(),
    size: integer('size').notNull(),
    width: integer('width'),
    height: integer('height'),
    blurhash: text('blurhash'),
    status: mediaStatusEnum('status').notNull().default('quarantine'),
    createdAt: createdAt(),
  },
  (t) => [index('post_media_post_idx').on(t.postId), index('post_media_status_idx').on(t.status, t.createdAt)],
)

export const replies = pgTable(
  'replies',
  {
    id: id(),
    postId: uuid('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
    /** null nach endgültiger Kontolöschung – die Antwort bleibt als «Antwort gelöscht» stehen */
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    body: text('body').notNull(),
    authorHandle: text('author_handle').notNull(),
    glyphSeed: integer('glyph_seed').notNull(),
    isAuthor: boolean('is_author').notNull().default(false),
    status: contentStatusEnum('status').notNull().default('visible'),
    crisisLevel: crisisLevelEnum('crisis_level').notNull().default('none'),
    helpful: boolean('helpful').notNull().default(false),
    hiddenByAuthor: boolean('hidden_by_author').notNull().default(false),
    createdAt: createdAt(),
    deletedAt: ts('deleted_at'),
  },
  (t) => [index('replies_post_created_idx').on(t.postId, t.createdAt), index('replies_user_idx').on(t.userId)],
)

export const support = pgTable(
  'support',
  {
    postId: uuid('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    kind: supportKindEnum('kind').notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.postId, t.userId, t.kind] })],
)

export const bookmarks = pgTable(
  'bookmarks',
  {
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    postId: uuid('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.postId] })],
)

/* --------------------------------------------------------- Privater Raum */

export const checkins = pgTable(
  'checkins',
  {
    id: id(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    mood: smallint('mood').notNull(),
    note: text('note'),
    createdAt: createdAt(),
  },
  (t) => [index('checkins_user_created_idx').on(t.userId, t.createdAt.desc())],
)

/** Es wird nur gezählt, wie oft geatmet wurde – privat. */
export const breathLog = pgTable(
  'breath_log',
  {
    id: id(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    seconds: integer('seconds').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('breath_user_idx').on(t.userId)],
)

/** Im Browser verschlüsselt (AES-GCM). Der Server sieht nur Chiffretext. */
export const journalEntries = pgTable(
  'journal_entries',
  {
    id: id(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    ciphertext: text('ciphertext').notNull(),
    iv: text('iv').notNull(),
    salt: text('salt').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('journal_user_created_idx').on(t.userId, t.createdAt.desc())],
)

export const steps = pgTable('steps', {
  id: id(),
  text: text('text').notNull(),
  circleId: uuid('circle_id').references(() => circles.id, { onDelete: 'set null' }),
  isActive: boolean('is_active').notNull().default(true),
  sort: integer('sort').notNull().default(0),
})

export const stepLog = pgTable(
  'step_log',
  {
    id: id(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    stepId: uuid('step_id').notNull().references(() => steps.id, { onDelete: 'cascade' }),
    action: stepActionEnum('action').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('step_log_user_idx').on(t.userId, t.createdAt.desc())],
)

/* ------------------------------------------------------ Benachrichtigungen */

export type NotificationPayload = {
  count?: number
  kinds?: Partial<Record<'hear' | 'same' | 'strong', number>>
  excerpt?: string
  message?: string
}

export const notifications = pgTable(
  'notifications',
  {
    id: id(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    kind: notificationKindEnum('kind').notNull(),
    postId: uuid('post_id').references(() => posts.id, { onDelete: 'set null' }),
    payload: jsonb('payload').$type<NotificationPayload>().notNull().default({}),
    readAt: ts('read_at'),
    createdAt: createdAt(),
  },
  (t) => [index('notifications_user_idx').on(t.userId, t.readAt, t.createdAt.desc())],
)

export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: id(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull().unique(),
    keys: jsonb('keys').$type<{ p256dh: string; auth: string }>().notNull(),
    quietFrom: smallint('quiet_from').notNull().default(22),
    quietTo: smallint('quiet_to').notNull().default(7),
    createdAt: createdAt(),
  },
  (t) => [index('push_user_idx').on(t.userId)],
)

/* ---------------------------------------------------------- Sicherheit */

export const reports = pgTable(
  'reports',
  {
    id: id(),
    /** null = automatischer Treffer */
    reporterId: uuid('reporter_id').references(() => users.id, { onDelete: 'set null' }),
    targetType: targetTypeEnum('target_type').notNull(),
    targetId: uuid('target_id').notNull(),
    reason: reportReasonEnum('reason').notNull(),
    note: text('note'),
    status: reportStatusEnum('status').notNull().default('open'),
    /** 0 = acute, 1 = Sorge, 2 = Meldung, 3 = automatischer Treffer */
    priority: smallint('priority').notNull(),
    createdAt: createdAt(),
    resolvedAt: ts('resolved_at'),
  },
  (t) => [
    index('reports_queue_idx').on(t.status, t.priority, t.createdAt),
    index('reports_target_idx').on(t.targetType, t.targetId),
    uniqueIndex('reports_once_idx')
      .on(t.reporterId, t.targetType, t.targetId)
      .where(sql`reporter_id IS NOT NULL AND status = 'open'`),
  ],
)

export const blocks = pgTable(
  'blocks',
  {
    blockerId: uuid('blocker_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    blockedId: uuid('blocked_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.blockerId, t.blockedId] }), index('blocks_blocked_idx').on(t.blockedId)],
)

/** Audit-Log. Ein Trigger verhindert UPDATE und DELETE. */
export const moderationActions = pgTable(
  'moderation_actions',
  {
    id: id(),
    moderatorId: uuid('moderator_id'),
    targetType: targetTypeEnum('target_type').notNull(),
    targetId: uuid('target_id').notNull(),
    action: text('action').notNull(),
    reason: text('reason'),
    createdAt: createdAt(),
  },
  (t) => [index('modactions_target_idx').on(t.targetType, t.targetId), index('modactions_created_idx').on(t.createdAt.desc())],
)

export const helpResources = pgTable('help_resources', {
  id: id(),
  name: text('name').notNull(),
  phone: text('phone'),
  url: text('url'),
  hours: text('hours').notNull(),
  audience: text('audience').notNull(),
  sort: integer('sort').notNull().default(0),
  region: text('region').notNull().default('CH'),
})

export const crisisTerms = pgTable(
  'crisis_terms',
  {
    id: id(),
    term: text('term').notNull(),
    level: crisisTermLevelEnum('level').notNull(),
    language: text('language').notNull().default('de'),
  },
  (t) => [uniqueIndex('crisis_terms_term_idx').on(t.language, t.term)],
)

export const rateLimits = pgTable('rate_limits', {
  key: text('key').primaryKey(),
  windowStart: ts('window_start').notNull(),
  count: integer('count').notNull(),
})

export const exports = pgTable(
  'exports',
  {
    id: id(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    status: exportStatusEnum('status').notNull().default('pending'),
    bucketKey: text('bucket_key'),
    createdAt: createdAt(),
    expiresAt: ts('expires_at'),
  },
  (t) => [index('exports_user_idx').on(t.userId, t.createdAt.desc())],
)

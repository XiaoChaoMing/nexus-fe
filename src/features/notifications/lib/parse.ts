import {
  NOTIFICATION_TYPES,
  type AppNotification,
  type ChannelRef,
  type NotificationPage,
  type NotificationPayload,
  type NotificationSetting,
  type NotificationSettings,
  type NotificationType,
  type PersonRef,
  type ScheduleReason,
  type SystemKind,
} from '@/features/notifications/types'

/** notification-svc payloads are untrusted: unknown types and broken items are dropped, never thrown. */

type Rec = Record<string, unknown>

function isRec(v: unknown): v is Rec {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function strOrNull(v: unknown): string | null {
  return typeof v === 'string' && v !== '' ? v : null
}

function isDate(v: unknown): v is string {
  return typeof v === 'string' && !Number.isNaN(Date.parse(v))
}

function oneOf<T extends string>(v: unknown, values: readonly T[]): T | null {
  return typeof v === 'string' && (values as readonly string[]).includes(v) ? (v as T) : null
}

/** Only same-origin paths and http(s) URLs are used as image sources. */
function imageUrl(v: unknown): string | null {
  if (typeof v !== 'string' || v.length === 0 || v.length > 2048) return null
  if (v.startsWith('/') && !v.startsWith('//')) return v

  return /^https?:\/\//i.test(v) ? v : null
}

function channelRef(v: unknown): ChannelRef | null {
  if (!isRec(v) || !str(v.id)) return null
  const handle = str(v.handle)

  return { id: str(v.id), handle, displayName: str(v.displayName) || handle, avatarUrl: imageUrl(v.avatarUrl) }
}

function personRef(v: unknown): PersonRef | null {
  if (!isRec(v) || !str(v.id)) return null
  const username = str(v.username)

  return { id: str(v.id), username, displayName: str(v.displayName) || username }
}

const SCHEDULE_REASONS: readonly ScheduleReason[] = ['CANCELLED', 'MOVED', 'SERIES_CHANGED', 'CREATED']
const SYSTEM_KINDS: readonly SystemKind[] = ['CHANNEL_SUSPENDED', 'CHANNEL_RESTORED', 'STREAM_TAKEDOWN']

export function parsePayload(type: NotificationType | null, raw: unknown): NotificationPayload {
  const p = isRec(raw) ? raw : {}
  switch (type) {
    case 'CREATOR_LIVE':
      return { type, channel: channelRef(p.channel), streamId: str(p.streamId), title: str(p.title) }
    case 'STREAM_STARTING':
      return { type, channel: channelRef(p.channel), occurrenceAt: isDate(p.occurrenceAt) ? p.occurrenceAt : null, title: str(p.title) }
    case 'SCHEDULE':
      return {
        type,
        channel: channelRef(p.channel),
        title: str(p.title),
        occurrenceAt: isDate(p.occurrenceAt) ? p.occurrenceAt : null,
        newOccurrenceAt: isDate(p.newOccurrenceAt) ? p.newOccurrenceAt : null,
        reason: oneOf(p.reason, SCHEDULE_REASONS) ?? 'SERIES_CHANGED',
      }
    case 'MENTION':
      return { type, channel: channelRef(p.channel), streamId: str(p.streamId), lastSender: personRef(p.lastSender), excerpt: str(p.excerpt) }
    case 'NEW_FOLLOWER':
      return { type, lastFollower: personRef(p.lastFollower) }
    case 'CREATOR_APPLICATION':
      return { type, result: p.result === 'APPROVED' ? 'APPROVED' : 'REJECTED', reason: strOrNull(p.reason) }
    case 'REPORT_RESULT':
      return { type, result: p.result === 'DISMISSED' ? 'DISMISSED' : 'RESOLVED' }
    case 'SYSTEM': {
      const kind = oneOf(p.kind, SYSTEM_KINDS)

      return kind ? { type, kind, reason: str(p.reason), title: strOrNull(p.title) } : { type: 'UNKNOWN' }
    }
    default:
      return { type: 'UNKNOWN' }
  }
}

/** Server links are app paths ("/live/…", "/kaelen?tab=schedule"); anything else is not followed. */
export function safeLink(v: unknown): string | null {
  if (typeof v !== 'string' || !v.startsWith('/') || v.startsWith('//') || v.startsWith('/\\') || v.length > 512) return null
  // NEW_FOLLOWER points at "/studio/dashboard"; the Studio overview of this app is "/studio".
  if (v === '/studio/dashboard') return '/studio'

  return v
}

export function parseNotification(v: unknown): AppNotification | null {
  if (!isRec(v)) return null
  const id = str(v.id)
  if (!id) return null
  const type = oneOf(v.type, NOTIFICATION_TYPES)
  const createdAt = isDate(v.createdAt) ? v.createdAt : new Date(0).toISOString()
  const groupCount = typeof v.groupCount === 'number' && Number.isFinite(v.groupCount) && v.groupCount > 0 ? Math.floor(v.groupCount) : 1

  return {
    id,
    payload: parsePayload(type, v.payload),
    link: safeLink(v.link),
    groupCount,
    read: v.read === true,
    createdAt,
    updatedAt: isDate(v.updatedAt) ? v.updatedAt : createdAt,
  }
}

export function parseNotificationPage(v: unknown): NotificationPage {
  const r = isRec(v) ? v : {}
  const items = Array.isArray(r.items) ? r.items.map(parseNotification).filter((n): n is AppNotification => n !== null) : []

  return { items, nextCursor: strOrNull(r.nextCursor) }
}

export function parseCount(v: unknown): number {
  const c = isRec(v) ? v.count : null

  return typeof c === 'number' && Number.isFinite(c) && c >= 0 ? Math.floor(c) : 0
}

function parseSetting(v: unknown): NotificationSetting | null {
  if (!isRec(v)) return null
  const type = oneOf(v.type, NOTIFICATION_TYPES)
  if (!type) return null

  return {
    type,
    inApp: v.inApp === true,
    email: v.email === true,
    inAppLocked: v.inAppLocked === true,
    emailLocked: v.emailLocked === true,
    emailAvailable: v.emailAvailable !== false,
  }
}

/** Settings in BR-E01 order whatever order the server sends. */
export function parseSettings(v: unknown): NotificationSettings {
  const r = isRec(v) ? v : {}
  const items = (Array.isArray(r.items) ? r.items : []).map(parseSetting).filter((s): s is NotificationSetting => s !== null)
  items.sort((a, b) => NOTIFICATION_TYPES.indexOf(a.type) - NOTIFICATION_TYPES.indexOf(b.type))

  return { items, emailVerified: r.emailVerified === true }
}

/** `POST /v1/notifications/unsubscribe` → the type whose e-mails were turned off. */
export function parseUnsubscribed(v: unknown): NotificationType | null {
  return isRec(v) ? oneOf(v.type, NOTIFICATION_TYPES) : null
}

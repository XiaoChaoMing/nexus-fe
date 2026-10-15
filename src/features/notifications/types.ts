/**
 * notification-svc shapes (TSD GĐ5 §5.1, §5.5; API catalog §6D). Parsed from untrusted JSON in `lib/parse.ts`; the
 * in-app sentence is built here from `type` + `payload` (NXL-E §7.4), never taken from the server.
 */

/** The eight types in BR-E01 order (settings table order). */
export const NOTIFICATION_TYPES = [
  'CREATOR_LIVE',
  'STREAM_STARTING',
  'SCHEDULE',
  'MENTION',
  'NEW_FOLLOWER',
  'REPORT_RESULT',
  'CREATOR_APPLICATION',
  'SYSTEM',
] as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export type ChannelRef = { id: string; handle: string; displayName: string; avatarUrl: string | null }
export type PersonRef = { id: string; username: string; displayName: string }

export type ScheduleReason = 'CANCELLED' | 'MOVED' | 'SERIES_CHANGED' | 'CREATED'
export type SystemKind = 'CHANNEL_SUSPENDED' | 'CHANNEL_RESTORED' | 'STREAM_TAKEDOWN'

export type NotificationPayload =
  | { type: 'CREATOR_LIVE'; channel: ChannelRef | null; streamId: string; title: string }
  | { type: 'STREAM_STARTING'; channel: ChannelRef | null; occurrenceAt: string | null; title: string }
  | { type: 'SCHEDULE'; channel: ChannelRef | null; title: string; occurrenceAt: string | null; newOccurrenceAt: string | null; reason: ScheduleReason }
  | { type: 'MENTION'; channel: ChannelRef | null; streamId: string; lastSender: PersonRef | null; excerpt: string }
  | { type: 'NEW_FOLLOWER'; lastFollower: PersonRef | null }
  | { type: 'CREATOR_APPLICATION'; result: 'APPROVED' | 'REJECTED'; reason: string | null }
  | { type: 'REPORT_RESULT'; result: 'RESOLVED' | 'DISMISSED' }
  | { type: 'SYSTEM'; kind: SystemKind; reason: string; title: string | null }
  | { type: 'UNKNOWN' }

export type AppNotification = {
  id: string
  payload: NotificationPayload
  /** Internal path the item opens; null = not clickable (e.g. a dismissed report). */
  link: string | null
  groupCount: number
  read: boolean
  createdAt: string
  updatedAt: string
}

export type NotificationPage = { items: AppNotification[]; nextCursor: string | null }

export type NotificationSetting = {
  type: NotificationType
  inApp: boolean
  email: boolean
  inAppLocked: boolean
  emailLocked: boolean
  /** False when the type has no e-mail at all ("—" in the table). */
  emailAvailable: boolean
}

export type NotificationSettings = { items: NotificationSetting[]; emailVerified: boolean }

export type NotificationFilter = 'all' | 'unread'

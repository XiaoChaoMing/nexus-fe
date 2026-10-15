import type { ChatBadge } from '@/features/chat/types'

/**
 * Chat moderation, roles, blocks and reports (TSD GĐ5 §5.1–§5.4). Parsed from untrusted JSON in `lib/parse.ts`.
 */

export type UserRef = { id: string; username: string; displayName: string }
export type ActorRef = { id: string; username: string }

export type RestrictionType = 'BAN' | 'TIMEOUT'

/** A ban (`until` null) or a running timeout of the channel's chat. */
export type Restriction = {
  user: UserRef
  type: RestrictionType
  until: string | null
  actor: ActorRef | null
  reason: string | null
  createdAt: string
}

export type ChannelRoleName = 'MODERATOR' | 'VIP'

export type ChannelRole = { user: UserRef; role: ChannelRoleName; grantedBy: ActorRef | null; createdAt: string }

/** A user seen from a channel's chat; `restriction` only reaches moderators. */
export type UserCard = {
  user: UserRef
  badges: ChatBadge[]
  createdAt: string | null
  role: 'OWNER' | ChannelRoleName | null
  followedAt: string | null
  restriction: { type: RestrictionType; until: string | null } | null
}

export type BlockedTerm = { id: string; term: string; createdBy: ActorRef | null; createdAt: string }

export type ModChannel = {
  channel: { id: string; handle: string; displayName: string; avatarUrl: string | null; isLive: boolean }
  role: ChannelRoleName
}

export type Block = { user: UserRef; createdAt: string }

export type Page<T> = { items: T[]; nextCursor: string | null }

export const REPORT_REASONS = ['SPAM', 'HARASSMENT', 'VIOLENCE', 'SENSITIVE', 'COPYRIGHT', 'OTHER'] as const
export type ReportReason = (typeof REPORT_REASONS)[number]

/** What is reported, with what the modal shows about it. */
export type ReportTarget =
  | { type: 'MESSAGE'; id: string; streamId: string; author: { id: string; username: string; displayName: string; color: string | null; badges: ChatBadge[] }; body: string }
  | { type: 'USER'; id: string; username: string; displayName: string; streamId: string | null }
  | { type: 'STREAM'; id: string; title: string; channelName: string; thumbnailUrl: string | null }
  | { type: 'CHANNEL'; id: string; displayName: string; handle: string; avatarUrl: string | null }

/** Limits shared with chat-svc (TSD §5.2) and identity (§5.3). */
export const MOD_LIMITS = {
  /** Moderators and VIPs per channel, each. */
  rolesPerChannel: 50,
  blockedTerms: 100,
  termMin: 2,
  termMax: 100,
  /** CHAT_TIMEOUT_MAX: 14 days. */
  timeoutMaxSec: 1_209_600,
  reportNoteMax: 500,
  reasonMax: 500,
} as const

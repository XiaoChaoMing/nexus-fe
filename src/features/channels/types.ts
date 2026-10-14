/** channel-svc shapes of GĐ4 (TSD GĐ4 §5.1–5.2). */

export type NotifyLevel = 'ALL' | 'LIVE_ONLY' | 'OFF'

export const NOTIFY_LEVELS: readonly NotifyLevel[] = ['ALL', 'LIVE_ONLY', 'OFF']

export type ChannelCard = {
  id: string
  handle: string
  displayName: string
  avatarUrl: string | null
  verified: boolean
}

/** channel-svc embeds a category with its name; stream-svc only gives `{id}`. */
export type CategoryRef = { id: string; slug: string; name: string }

export type LiveStreamRef = {
  id: string
  title: string
  category: CategoryRef | null
  viewerCount: number | null
  isMature: boolean
  startedAt: string
}

export type SocialLinkType = 'YOUTUBE' | 'X' | 'FACEBOOK' | 'TIKTOK' | 'DISCORD' | 'WEBSITE'

export const SOCIAL_LINK_TYPES: readonly SocialLinkType[] = ['YOUTUBE', 'X', 'FACEBOOK', 'TIKTOK', 'DISCORD', 'WEBSITE']

export type SocialLink = { type: SocialLinkType; url: string }

export type ProfileViewer = { following: boolean; notifyLevel: NotifyLevel | null; isOwner: boolean }

/** `GET /v1/channels/{handle}` (token optional). */
export type ChannelProfileFull = {
  id: string
  handle: string
  displayName: string
  bio: string | null
  avatarUrl: string | null
  bannerUrl: string | null
  socialLinks: SocialLink[]
  verified: boolean
  matureDefault: boolean
  status: string
  followerCount: number
  isLive: boolean
  currentStreamId: string | null
  currentStream: LiveStreamRef | null
  lastLiveAt: string | null
  createdAt: string
  viewer: ProfileViewer | null
}

export type FollowState = { following: boolean; notifyLevel: NotifyLevel | null; followedAt: string | null }

export type FollowedChannel = {
  channel: ChannelCard
  isLive: boolean
  currentStream: LiveStreamRef | null
  lastLiveAt: string | null
  notifyLevel: NotifyLevel
  followedAt: string
}

export type Page<T> = { items: T[]; nextCursor: string | null }

export type SidebarFollowing = { live: FollowedChannel[]; offline: FollowedChannel[]; totalFollowing: number }

/** One broadcast of a schedule (`GET /v1/channels/{id}/schedule`). `reminded` is null for guests. */
export type Occurrence = {
  scheduleId: string
  occurrenceAt: string
  title: string
  category: CategoryRef | null
  durationMin: number
  streamId: string | null
  reminded: boolean | null
}

export type Reminder = { scheduleId: string; occurrenceAt: string; createdAt: string }

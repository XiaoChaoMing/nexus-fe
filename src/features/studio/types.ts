import type { CategoryIdRef } from '@/features/streams/types'
import type { CategoryRef, ChannelProfileFull, SocialLink } from '@/features/channels/types'

/** Studio shapes of GĐ4 (TSD GĐ4 §5.1–5.3). */

export type StudioChannel = Omit<ChannelProfileFull, 'viewer'> & {
  handleChangedAt: string | null
  nextHandleChangeAt: string | null
}

export type ChannelPatch = {
  displayName?: string
  bio?: string | null
  socialLinks?: SocialLink[]
  matureDefault?: boolean
  handle?: string
}

export type StatsRange = '7d' | '28d'

export type ChannelStats = {
  range: StatsRange
  followerCount: number
  newFollowers: number
  upcoming: { scheduleId: string; occurrenceAt: string; title: string; reminderCount: number } | null
}

export type DashboardStream = {
  streamId: string
  title: string
  startedAt: string
  endedAt: string
  durationSec: number
  endReason: 'creator' | 'ingest_timeout' | 'admin_takedown' | null
  peakViewers: number | null
  vodId: string | null
  vodVisibility: 'PUBLIC' | 'HIDDEN' | null
}

export type Dashboard = {
  current: { streamId: string; title: string; status: string; startedAt: string; viewerCount: number | null } | null
  recentStreams: DashboardStream[]
  stats: { range: StatsRange; streamCount: number; liveSeconds: number; vodReadyPublic: number; vodReadyHidden: number }
}

export type VodVisibility = 'PUBLIC' | 'HIDDEN'

export type StudioVod = {
  id: string
  streamId: string
  title: string
  durationSec: number
  thumbnailUrl: string
  manifestUrl: string
  status: 'READY' | 'EXPIRED'
  visibility: VodVisibility
  category: CategoryIdRef | null
  createdAt: string
  expiresAt: string
}

export type ScheduleStatus = 'ACTIVE' | 'CANCELLED'

export type Schedule = {
  id: string
  title: string
  category: CategoryRef | null
  startAt: string
  durationMin: number
  rrule: string | null
  timezone: string
  status: ScheduleStatus
  parentId: string | null
  nextOccurrences: { occurrenceAt: string; reminderCount: number; streamId: string | null }[]
  createdAt: string
  updatedAt: string
}

export type ScheduleInput = {
  title: string
  categoryId: string | null
  startAt: string
  durationMin: number
  rrule: string | null
  timezone: string
}

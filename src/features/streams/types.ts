/** Shapes of stream-svc responses (Swagger: http://localhost:8092/swagger/index.html). */

export type StreamStatus = 'LIVE' | 'INTERRUPTED' | 'ENDED'

/** `GET /v1/streams/{id}` may also return a scheduled broadcast (TSD GĐ4 §5.1); lists never do. */
export type ScheduledStatus = 'SCHEDULED' | 'CANCELLED'

/** stream-svc only carries the category id; names and slugs come from `GET /v1/categories`. */
export type CategoryIdRef = { id: string }

/** Channel shown with a stream, VOD or the Studio (TSD GĐ1 §4.3); null for data from before GĐ1. */
export type ChannelSummary = {
  id: string
  handle: string
  displayName: string
  avatarUrl: string | null
}

export type Stream = {
  id: string
  channelId: string
  title: string
  tags: string[]
  language: string
  isMature: boolean
  status: StreamStatus
  startedAt: string | null
  endedAt: string | null
  endReason: 'creator' | 'ingest_timeout' | 'admin_takedown' | null
  manifestUrl: string
  thumbnailUrl: string
  vodId: string | null
  channel?: ChannelSummary | null
  /** Viewers right now (TSD GĐ3 §4 S4), null when unknown; absent from servers before GĐ3. */
  viewerCount?: number | null
  category?: CategoryIdRef | null
}

/** A stream as `GET /v1/streams/{id}` returns it: it can be an upcoming (or cancelled) scheduled broadcast. */
export type StreamDetail = Omit<Stream, 'status'> & {
  status: StreamStatus | ScheduledStatus
  scheduleId?: string | null
  scheduledStartAt?: string | null
}

export type StreamList = {
  items: Stream[]
  nextCursor: string | null
}

export type Vod = {
  id: string
  streamId: string
  channelId: string
  title: string
  durationSec: number
  manifestUrl: string
  thumbnailUrl: string
  status: string
  createdAt: string
  expiresAt: string
  channel?: ChannelSummary | null
  category?: CategoryIdRef | null
  isMature?: boolean
  visibility?: 'PUBLIC' | 'HIDDEN'
  /** Only with a token: where this account stopped watching (null = never watched). */
  viewer?: { positionSec: number | null }
}

/**
 * `POST /v1/streams/{id}/playback` and `/v1/vods/{id}/playback` (TSD GĐ2 §4). The first three are null while the
 * 18+ gate is closed; `anonId` comes back for guests only.
 */
export type Playback = {
  sessionId: string | null
  manifestUrl: string | null
  expiresAt: string | null
  anonId?: string
  mature: { required: boolean; acknowledged: boolean }
}

/** One row of `GET /v1/me/continue-watching`. */
export type ContinueWatchingItem = {
  vod: Vod
  positionSec: number
  updatedAt: string
}

export type VodList = {
  items: Vod[]
  nextCursor: string | null
}

/** `GET /v1/channels/{handle}`: the GĐ1 fields, plus the GĐ4 profile (TSD GĐ4 §5.1) — see `features/channels/types`. */
export type ChannelProfile = {
  id: string
  handle: string
  displayName: string
  bio: string | null
  avatarUrl: string | null
  isLive: boolean
  currentStreamId: string | null
  createdAt: string
}

export type Health = {
  fps: number
  bitrateKbps: number
  droppedFrames: number
  speed: number
  uploadErrors: number
  reportedAt: string
}

export type StreamSettings = {
  title: string
  tags: string[]
  language: string
  isMature: boolean
  /** GĐ4: absent from older servers. */
  categoryId?: string | null
  updatedAt: string | null
}

export type StudioStream = {
  streamId: string
  status: StreamStatus
  startedAt: string | null
  interruptedAt: string | null
  manifestUrl: string
  health: Health | null
}

export type Studio = {
  settings: StreamSettings
  current: StudioStream | null
  channel?: ChannelSummary | null
}

export type StreamKeyInfo = {
  hasKey: boolean
  rtmpUrl: string
  createdAt: string | null
}

export type StreamKeyCreated = {
  streamKey: string
  rtmpUrl: string
}

export type SettingsInput = {
  title: string
  tags: string[]
  language: string
  isMature: boolean
  /** PUT semantics: leaving it out clears the category (TSD GĐ4 §5.3), so it is always sent. */
  categoryId: string | null
}

export function isOnAir(status: StreamStatus | undefined): boolean {
  return status === 'LIVE' || status === 'INTERRUPTED'
}

/** A detail that is a regular (on-air or ended) stream, not an upcoming or cancelled broadcast. */
export function isRegularStream(s: StreamDetail): s is Stream {
  return s.status === 'LIVE' || s.status === 'INTERRUPTED' || s.status === 'ENDED'
}

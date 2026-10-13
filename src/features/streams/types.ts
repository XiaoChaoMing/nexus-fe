/** Shapes of stream-svc responses (Swagger: http://localhost:8092/swagger/index.html). */

export type StreamStatus = 'LIVE' | 'INTERRUPTED' | 'ENDED'

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
}

export function isOnAir(status: StreamStatus | undefined): boolean {
  return status === 'LIVE' || status === 'INTERRUPTED'
}

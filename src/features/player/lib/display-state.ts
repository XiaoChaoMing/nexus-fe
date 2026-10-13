import type { StreamStatus } from '@/features/streams/types'

/** What the hls.js wrapper reports about loading. */
export type PlaybackPhase = 'idle' | 'loading' | 'playing' | 'reconnecting' | 'error'

/** What the viewer sees (NXL-A §9B, design 03b · Player — Trạng thái). */
export type DisplayState =
  | 'mature'
  | 'loading'
  | 'live'
  | 'buffering'
  | 'reconnecting'
  | 'interrupted'
  | 'ended'
  | 'error'

/** 03b state 1: loading longer than this switches to state 9 (error with "Thử lại"). */
export const LOADING_TIMEOUT_MS = 10_000

export type DisplayInput = {
  apiStatus: StreamStatus | undefined
  phase: PlaybackPhase
  buffering: boolean
  videoEnded: boolean
  atLiveEdge: boolean
  matureBlocked: boolean
  /** The playback session could not be opened (request failed, or no manifest came back). */
  sourceFailed?: boolean
  /** Still loading after LOADING_TIMEOUT_MS. */
  loadingTimedOut?: boolean
  /** VOD playback: reaching the end of the video means "ended". */
  vod?: boolean
}

/**
 * Combines the stream status from the API with the player state. Order matters: a viewer who is
 * rewound keeps watching through INTERRUPTED and ENDED until they reach the end of what was recorded.
 */
export function displayState(i: DisplayInput): DisplayState {
  if (i.matureBlocked) return 'mature'
  if (i.vod && i.videoEnded) return 'ended'
  // Ended: the video ran out, or the viewer waits at the live edge for segments that will never come.
  if (i.apiStatus === 'ENDED' && (i.videoEnded || i.phase === 'idle' || i.phase === 'error' || (i.atLiveEdge && i.buffering))) return 'ended'
  if (i.sourceFailed || i.phase === 'error') return 'error'
  if (i.apiStatus === 'INTERRUPTED' && i.atLiveEdge && (i.buffering || i.phase !== 'playing')) return 'interrupted'
  if (i.phase === 'reconnecting') return 'reconnecting'
  if (i.phase === 'loading' || i.phase === 'idle') return i.loadingTimedOut ? 'error' : 'loading'
  if (i.buffering) return 'buffering'

  return 'live'
}

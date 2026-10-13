import type { StreamStatus } from '@/features/streams/types'

/** What the hls.js wrapper reports about loading. */
export type PlaybackPhase = 'idle' | 'loading' | 'playing' | 'reconnecting' | 'error'

/** What the viewer sees (NXL-A §9B). */
export type DisplayState =
  | 'mature'
  | 'loading'
  | 'live'
  | 'buffering'
  | 'reconnecting'
  | 'interrupted'
  | 'ended'
  | 'error'

export type DisplayInput = {
  apiStatus: StreamStatus | undefined
  phase: PlaybackPhase
  buffering: boolean
  videoEnded: boolean
  atLiveEdge: boolean
  matureBlocked: boolean
}

/**
 * Combines the stream status from the API with the player state. Order matters: a viewer who is
 * rewound keeps watching through INTERRUPTED and ENDED until they reach the end of what was recorded.
 */
export function displayState(i: DisplayInput): DisplayState {
  if (i.matureBlocked) return 'mature'
  if (i.apiStatus === 'ENDED' && (i.videoEnded || i.phase === 'idle' || i.phase === 'error')) return 'ended'
  if (i.phase === 'error') return 'error'
  if (i.apiStatus === 'INTERRUPTED' && i.atLiveEdge && (i.buffering || i.phase !== 'playing')) return 'interrupted'
  if (i.phase === 'reconnecting') return 'reconnecting'
  if (i.phase === 'loading' || i.phase === 'idle') return 'loading'
  if (i.buffering) return 'buffering'

  return 'live'
}

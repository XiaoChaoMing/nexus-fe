import type { Stream } from '@/features/streams/types'

/** media-svc publishes the VOD within seconds; after this long none is coming (nothing was recorded). */
export const VOD_WAIT_MS = 2 * 60_000

export type ReplayState = 'ready' | 'processing' | 'none'

/** Which "ended" variant to show (03b states 6, 7, 8). */
export function replayState(stream: Pick<Stream, 'vodId' | 'endedAt'>, now: number): ReplayState {
  if (stream.vodId) return 'ready'
  if (stream.endedAt && now - new Date(stream.endedAt).getTime() > VOD_WAIT_MS) return 'none'

  return 'processing'
}

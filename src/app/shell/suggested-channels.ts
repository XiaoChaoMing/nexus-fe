import type { Stream } from '@/features/streams/types'

/** NXL-C BR30/BR31: at most this many channels in a sidebar list. */
export const SIDEBAR_CHANNELS_MAX = 10

/** One entry per live channel (a channel streams once at a time); a stream from before GĐ1 has no channel and stands alone. */
export function suggestedChannels(streams: Stream[] | undefined, max = SIDEBAR_CHANNELS_MAX): Stream[] {
  const seen = new Set<string>()
  const out: Stream[] = []
  for (const s of streams ?? []) {
    const key = s.channel?.id ?? s.id
    if (seen.has(key)) continue
    seen.add(key)
    out.push(s)
    if (out.length >= max) break
  }

  return out
}

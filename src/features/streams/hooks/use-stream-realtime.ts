import { useQueryClient } from '@tanstack/react-query'
import { streamKeys } from '@/features/streams/hooks/use-streams'
import { applyStreamEvent, applyStreamSnapshot } from '@/features/streams/lib/stream-events'
import type { Stream } from '@/features/streams/types'
import { useRealtimeStatus, useRealtimeTopic } from '@/lib/realtime'

/**
 * Listens to `stream:{streamId}` and writes status, viewer count, title and VOD id into the cached stream, so
 * the page reacts at once; `useStream` keeps polling (slower) as the fallback. Returns true while connected.
 */
export function useStreamRealtime(streamId: string, enabled: boolean): boolean {
  const qc = useQueryClient()
  const status = useRealtimeStatus()
  const key = streamKeys.stream(streamId)

  const update = (fn: (s: Stream) => Stream) => {
    const before = qc.getQueryData<Stream>(key)
    if (!before) return
    const after = fn(before)
    if (after === before) return
    qc.setQueryData<Stream>(key, after)
    // The end of a broadcast: fetch the authoritative row (endedAt, VOD) right away.
    if (before.status !== 'ENDED' && after.status === 'ENDED') void qc.invalidateQueries({ queryKey: key })
  }

  useRealtimeTopic(enabled && streamId ? `stream:${streamId}` : null, {
    onSubscribed: (snapshot) => update((s) => applyStreamSnapshot(s, snapshot)),
    onEvent: (ev) => update((s) => applyStreamEvent(s, ev.type, ev.data)),
  })

  return enabled && status === 'open'
}

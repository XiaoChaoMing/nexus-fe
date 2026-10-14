import { useQueryClient } from '@tanstack/react-query'
import { streamKeys } from '@/features/streams/hooks/use-streams'
import { applyStreamEvent, applyStreamSnapshot } from '@/features/streams/lib/stream-events'
import type { StreamDetail } from '@/features/streams/types'
import { useRealtimeStatus, useRealtimeTopic } from '@/lib/realtime'

/**
 * Listens to `stream:{streamId}` and writes status, viewer count, title and VOD id into the cached stream, so
 * the page reacts at once; `useStream` keeps polling (slower) as the fallback. Returns true while connected.
 */
export function useStreamRealtime(streamId: string, enabled: boolean): boolean {
  const qc = useQueryClient()
  const status = useRealtimeStatus()
  const key = streamKeys.stream(streamId)

  const update = (fn: (s: StreamDetail) => StreamDetail) => {
    const before = qc.getQueryData<StreamDetail>(key)
    if (!before) return
    const after = fn(before)
    if (after === before) return
    qc.setQueryData<StreamDetail>(key, after)
    // The end of a broadcast: fetch the authoritative row (endedAt, VOD) right away.
    // The end of a broadcast, or an upcoming one going live: fetch the authoritative row (endedAt, VOD, manifest).
    if (before.status !== after.status && (after.status === 'ENDED' || before.status === 'SCHEDULED')) void qc.invalidateQueries({ queryKey: key })
  }

  useRealtimeTopic(enabled && streamId ? `stream:${streamId}` : null, {
    onSubscribed: (snapshot) => update((s) => applyStreamSnapshot(s, snapshot)),
    onEvent: (ev) => update((s) => applyStreamEvent(s, ev.type, ev.data)),
  })

  return enabled && status === 'open'
}

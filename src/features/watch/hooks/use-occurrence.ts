import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/stores/auth-store'
import { channelsApi } from '@/features/channels/api/channels-api'
import type { Occurrence } from '@/features/channels/types'
import type { StreamDetail } from '@/features/streams/types'

/** The schedule entry behind a SCHEDULED stream: duration, category and the viewer's reminder. */
export function useOccurrence(stream: StreamDetail): Occurrence | null {
  const viewer = useAuthStore((s) => s.user?.id ?? 'guest')
  const at = stream.scheduledStartAt ? Date.parse(stream.scheduledStartAt) : Number.NaN
  const { data } = useQuery({
    queryKey: ['channels', 'schedule', stream.channelId, 'occurrence', stream.scheduleId ?? '', stream.scheduledStartAt ?? '', viewer],
    queryFn: () => channelsApi.schedule(stream.channelId, { from: new Date(at - 60_000).toISOString(), to: new Date(at + 60_000).toISOString() }),
    enabled: Boolean(stream.scheduleId) && Number.isFinite(at),
    staleTime: 60_000,
  })

  return data?.items.find((o) => o.scheduleId === stream.scheduleId && Date.parse(o.occurrenceAt) === at) ?? null
}

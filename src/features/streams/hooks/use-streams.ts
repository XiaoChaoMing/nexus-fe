import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { streamsApi, studioApi } from '@/features/streams/api/streams-api'
import { isOnAir, type SettingsInput } from '@/features/streams/types'
import { isApiError } from '@/lib/api-error'

export const streamKeys = {
  live: ['streams', 'live'] as const,
  stream: (id: string) => ['streams', id] as const,
  vod: (id: string) => ['vods', id] as const,
  studio: ['studio', 'stream'] as const,
  key: ['studio', 'stream-key'] as const,
}

const LIVE_LIST_REFRESH = 15_000
const STREAM_POLL = 5_000
const STUDIO_POLL = 3_000
const VOD_WAIT_MS = 2 * 60_000

/** Streams on air for the home grid; refreshed until realtime updates arrive (GĐ3). */
export function useLiveStreams() {
  return useQuery({
    queryKey: streamKeys.live,
    queryFn: () => streamsApi.listLive(),
    refetchInterval: LIVE_LIST_REFRESH,
    placeholderData: keepPreviousData,
  })
}

/** Polls while the stream is on air, and while an ended stream still waits for its VOD. */
export function useStream(id: string) {
  return useQuery({
    queryKey: streamKeys.stream(id),
    queryFn: () => streamsApi.get(id),
    retry: (count, err) => !(isApiError(err) && err.status === 404) && count < 2,
    refetchInterval: (q) => {
      const s = q.state.data
      if (!s) return false

      if (isOnAir(s.status)) return STREAM_POLL
      // Ended: keep asking for the VOD id for a while, then give up (nothing was recorded).
      const waiting = !s.vodId && s.endedAt !== null && Date.now() - new Date(s.endedAt).getTime() < VOD_WAIT_MS

      return waiting ? STREAM_POLL : false
    },
  })
}

export function useVod(id: string) {
  return useQuery({
    queryKey: streamKeys.vod(id),
    queryFn: () => streamsApi.getVod(id),
    retry: (count, err) => !(isApiError(err) && err.status === 404) && count < 2,
    staleTime: 5 * 60_000,
  })
}

export function useStreamKeyInfo() {
  return useQuery({ queryKey: streamKeys.key, queryFn: studioApi.keyInfo })
}

export function useStudio() {
  return useQuery({ queryKey: streamKeys.studio, queryFn: studioApi.overview, refetchInterval: STUDIO_POLL })
}

export function useCreateStreamKey() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: studioApi.createKey,
    onSuccess: () => qc.invalidateQueries({ queryKey: streamKeys.key }),
  })
}

export function useUpdateSettings() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (input: SettingsInput) => studioApi.updateSettings(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: streamKeys.studio }),
  })
}

export function useEndStream() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: studioApi.end,
    onSettled: () => qc.invalidateQueries({ queryKey: streamKeys.studio }),
  })
}

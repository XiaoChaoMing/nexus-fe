import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { streamsApi, studioApi, viewerApi } from '@/features/streams/api/streams-api'
import { channelsApi } from '@/features/channels/api/channels-api'
import { useAuthStore } from '@/features/auth/stores/auth-store'
import { isOnAir, type SettingsInput } from '@/features/streams/types'
import { isApiError } from '@/lib/api-error'

export const streamKeys = {
  live: ['streams', 'live'] as const,
  stream: (id: string) => ['streams', id] as const,
  vod: (id: string, viewer: string) => ['vods', id, viewer] as const,
  continueWatching: (viewer: string) => ['me', 'continue-watching', viewer] as const,
  /** Profile per viewer: the `viewer` block (follow state) depends on the account. */
  channel: (handle: string, viewer: string) => ['channels', handle, viewer] as const,
  recommended: (limit: number) => ['streams', 'recommended', limit] as const,
  studio: ['studio', 'stream'] as const,
  key: ['studio', 'stream-key'] as const,
}

const LIVE_LIST_REFRESH = 15_000
const STREAM_POLL = 5_000
/** With `stream:{id}` pushing status/title/VOD (GĐ3), polling is only a safety net. */
const STREAM_POLL_REALTIME = 30_000
const UPCOMING_POLL_REALTIME = 15_000
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

/**
 * Polls while the stream is on air, and while an ended stream still waits for its VOD. `realtime`: the page
 * receives `stream:{id}` updates, so polling slows down (it stays as the fallback when the socket is down).
 */
export function useStream(id: string, { realtime = false }: { realtime?: boolean } = {}) {
  return useQuery({
    queryKey: streamKeys.stream(id),
    queryFn: () => streamsApi.get(id),
    retry: (count, err) => !(isApiError(err) && err.status === 404) && count < 2,
    refetchInterval: (q) => {
      const s = q.state.data
      if (!s) return false

      const every = realtime ? STREAM_POLL_REALTIME : STREAM_POLL
      // Upcoming: `stream:{id}` announces the start (≤ 5 s, NXL-A AF04); polling covers a closed socket.
      if (s.status === 'SCHEDULED') return realtime ? UPCOMING_POLL_REALTIME : STREAM_POLL
      if (s.status === 'CANCELLED') return false
      if (isOnAir(s.status)) return every
      // Ended: keep asking for the VOD id for a while, then give up (nothing was recorded).
      const waiting = !s.vodId && s.endedAt !== null && Date.now() - new Date(s.endedAt).getTime() < VOD_WAIT_MS

      return waiting ? every : false
    },
  })
}

/** Signed-in viewers get `viewer.positionSec`; the key changes with the account so a sign-in refetches it. */
export function useVod(id: string) {
  const viewer = useAuthStore((s) => s.user?.id ?? 'guest')

  return useQuery({
    queryKey: streamKeys.vod(id, viewer),
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

/** "Tiếp tục xem" on Home (signed-in only). */
export function useContinueWatching(enabled: boolean) {
  const viewer = useAuthStore((s) => s.user?.id ?? 'guest')

  return useQuery({
    queryKey: streamKeys.continueWatching(viewer),
    queryFn: () => viewerApi.continueWatching(12),
    enabled,
    select: (d) => d?.items ?? [],
  })
}

/** Channel profile (`GET /v1/channels/{handle}`, follow state included for accounts); 404 is not retried. */
export function useChannelProfile(handle: string | undefined) {
  const viewer = useAuthStore((s) => s.user?.id ?? 'guest')

  return useQuery({
    queryKey: streamKeys.channel(handle ?? '', viewer),
    queryFn: () => channelsApi.profile(handle ?? ''),
    enabled: Boolean(handle),
    staleTime: 60_000,
    retry: (count, err) => !(isApiError(err) && err.status === 404) && count < 1,
  })
}

/** Live recommendations (Hero + "Kênh trực tiếp đề xuất" share one call; sidebar for guests). */
export function useRecommendedStreams(limit: number) {
  return useQuery({
    queryKey: streamKeys.recommended(limit),
    queryFn: () => streamsApi.recommended(limit),
    select: (d) => d?.items ?? [],
    refetchInterval: LIVE_LIST_REFRESH,
    placeholderData: keepPreviousData,
  })
}

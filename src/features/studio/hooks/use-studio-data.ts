import { useMemo } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { studioV4Api } from '@/features/studio/api'
import type { StatsRange, VodVisibility } from '@/features/studio/types'
import { isApiError } from '@/lib/api-error'

export const studioKeys = {
  channel: ['studio', 'channel'] as const,
  dashboard: (range: StatsRange) => ['studio', 'dashboard', range] as const,
  stats: (range: StatsRange) => ['studio', 'channel-stats', range] as const,
  vods: (filter: VodFilter) => ['studio', 'vods', filter] as const,
  vodsAll: ['studio', 'vods'] as const,
  schedules: ['studio', 'schedules'] as const,
}

/** NOT_CREATOR and 4xx do not get better by retrying. */
const retry = (count: number, err: unknown) => !(isApiError(err) && err.status >= 400 && err.status < 500) && count < 1

export function useStudioChannel() {
  return useQuery({ queryKey: studioKeys.channel, queryFn: studioV4Api.channel, retry, staleTime: 60_000 })
}

export function useDashboard(range: StatsRange) {
  return useQuery({ queryKey: studioKeys.dashboard(range), queryFn: () => studioV4Api.dashboard(range), retry })
}

export function useChannelStats(range: StatsRange) {
  return useQuery({ queryKey: studioKeys.stats(range), queryFn: () => studioV4Api.stats(range), retry })
}

export type VodFilter = 'all' | 'public' | 'hidden' | 'expired'

const FILTER_PARAMS: Record<VodFilter, { visibility?: VodVisibility; status?: 'READY' | 'EXPIRED' }> = {
  all: {},
  public: { visibility: 'PUBLIC', status: 'READY' },
  hidden: { visibility: 'HIDDEN', status: 'READY' },
  expired: { status: 'EXPIRED' },
}

export function useStudioVods(filter: VodFilter) {
  const query = useInfiniteQuery({
    queryKey: studioKeys.vods(filter),
    queryFn: ({ pageParam }) => studioV4Api.vods(FILTER_PARAMS[filter], pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last?.nextCursor ?? null,
    retry,
  })
  const items = useMemo(() => (query.data?.pages ?? []).flatMap((p) => p.items), [query.data])

  return { ...query, items }
}

/** Active schedules (with their next five broadcasts) and cancelled ones, for "Lịch của bạn". */
export function useSchedules() {
  const active = useQuery({ queryKey: [...studioKeys.schedules, 'ACTIVE'], queryFn: () => studioV4Api.schedules('ACTIVE'), select: (d) => d?.items ?? [], retry })
  const cancelled = useQuery({ queryKey: [...studioKeys.schedules, 'CANCELLED'], queryFn: () => studioV4Api.schedules('CANCELLED'), select: (d) => d?.items ?? [], retry })

  return { active, cancelled }
}

import { useMemo } from 'react'
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/stores/auth-store'
import { channelsApi } from '@/features/channels/api/channels-api'
import { applySidebarEvent, sidebarFromResponse, type SidebarState } from '@/features/channels/lib/sidebar'
import type { FollowedChannel, LiveStreamRef } from '@/features/channels/types'
import type { Stream } from '@/features/streams/types'
import { useRealtimeStatus, useRealtimeTopic } from '@/lib/realtime'

/** Without the socket the list is checked again every minute, silently (14 · Sidebar annotation). */
const SIDEBAR_FALLBACK_POLL = 60_000

export const followingKeys = {
  sidebar: (viewer: string) => ['me', 'following', 'sidebar', viewer] as const,
  list: (viewer: string, status: 'live' | 'all') => ['me', 'following', status, viewer] as const,
}

/**
 * "Kênh đang theo dõi": `GET /v1/me/following/sidebar`, then `sidebar:{userId}` events (TSD GĐ4 §5.4) applied to
 * the cached list; a resync or a channel the list does not know reloads it.
 */
export function useSidebarFollowing() {
  const qc = useQueryClient()
  const userId = useAuthStore((s) => (s.status === 'authenticated' ? (s.user?.id ?? null) : null))
  const ws = useRealtimeStatus()
  const key = followingKeys.sidebar(userId ?? 'guest')

  const query = useQuery({
    queryKey: key,
    queryFn: async () => sidebarFromResponse(await channelsApi.sidebar()),
    enabled: userId !== null,
    refetchInterval: ws === 'open' ? false : SIDEBAR_FALLBACK_POLL,
    staleTime: 30_000,
  })

  useRealtimeTopic(userId ? `sidebar:${userId}` : null, {
    onEvent: (ev) => {
      const current = qc.getQueryData<SidebarState>(key)
      if (!current) return
      const { state, unknownChannel } = applySidebarEvent(current, ev.type, ev.data)
      if (state !== current) qc.setQueryData(key, state)
      if (unknownChannel) void qc.invalidateQueries({ queryKey: key })
    },
    onResync: () => void qc.invalidateQueries({ queryKey: key }),
  })

  return query
}

/** Thumbnail of a live stream by the stream-svc object layout (`{STREAM_HLS_BASE}/streams/{id}/thumb.jpg`). */
export function liveThumbnail(streamId: string): string {
  return `/hls/streams/${encodeURIComponent(streamId)}/thumb.jpg`
}

/** A followed channel's broadcast as a card stream (channel-svc gives a `LiveStreamRef`, not a full `Stream`). */
export function streamOfFollowed(f: FollowedChannel, s: LiveStreamRef): Stream {
  return {
    id: s.id,
    channelId: f.channel.id,
    title: s.title,
    tags: [],
    language: '',
    isMature: s.isMature,
    status: 'LIVE',
    startedAt: s.startedAt,
    endedAt: null,
    endReason: null,
    manifestUrl: '',
    thumbnailUrl: liveThumbnail(s.id),
    vodId: null,
    channel: { id: f.channel.id, handle: f.channel.handle, displayName: f.channel.displayName, avatarUrl: f.channel.avatarUrl },
    viewerCount: s.viewerCount,
    category: s.category ? { id: s.category.id } : null,
  }
}

/** Followed channels live now, by viewers (one page, ≤ 200, TSD §5.2). */
export function useFollowedLive(limit = 50) {
  const viewer = useAuthStore((s) => (s.status === 'authenticated' ? (s.user?.id ?? null) : null))
  const query = useQuery({
    queryKey: [...followingKeys.list(viewer ?? 'guest', 'live'), limit],
    queryFn: () => channelsApi.following('live', null, limit),
    enabled: viewer !== null,
    staleTime: 30_000,
  })
  const streams = useMemo(() => (query.data?.items ?? []).flatMap((f) => (f.isLive && f.currentStream ? [streamOfFollowed(f, f.currentStream)] : [])), [query.data])

  return { ...query, streams }
}

/** Every followed channel, live first then by last broadcast (keyset pages). */
export function useFollowedAll() {
  const viewer = useAuthStore((s) => (s.status === 'authenticated' ? (s.user?.id ?? null) : null))
  const query = useInfiniteQuery({
    queryKey: followingKeys.list(viewer ?? 'guest', 'all'),
    queryFn: ({ pageParam }) => channelsApi.following('all', pageParam, 24),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last?.nextCursor ?? null,
    enabled: viewer !== null,
    staleTime: 30_000,
  })
  const items = useMemo(() => {
    const seen = new Set<string>()

    return (query.data?.pages ?? []).flatMap((p) => p.items).filter((f) => (seen.has(f.channel.id) ? false : (seen.add(f.channel.id), true)))
  }, [query.data])

  return { ...query, items }
}

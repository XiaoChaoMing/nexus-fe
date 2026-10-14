import { useMemo } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { streamsApi, type LiveFilter } from '@/features/streams/api/streams-api'
import type { Stream, Vod } from '@/features/streams/types'

const PAGE = 24

/** One entry per id across pages: a count change between two pages can repeat a card (NXL-C BR20). */
export function uniqueById<T extends { id: string }>(pages: { items: T[] }[] | undefined): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const p of pages ?? []) {
    for (const item of p.items) {
      if (seen.has(item.id)) continue
      seen.add(item.id)
      out.push(item)
    }
  }

  return out
}

/**
 * Live streams with filters, 24 per page. Loaded pages are not refetched in the background: the list never
 * reorders by itself (K1); "Có cập nhật mới" reloads it. `enabled: false` while a group pill waits for categories.
 */
export function useLiveList(filter: LiveFilter, enabled = true) {
  const query = useInfiniteQuery({
    queryKey: ['streams', 'browse', filter],
    queryFn: ({ pageParam }) => streamsApi.list({ ...filter, limit: PAGE }, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last?.nextCursor ?? null,
    enabled: enabled && !(filter.categories && filter.categories.length === 0),
    staleTime: Infinity,
  })
  const items = useMemo<Stream[]>(() => uniqueById(query.data?.pages), [query.data])

  return { ...query, items, empty: Boolean(filter.categories && filter.categories.length === 0) }
}

export function useVodList(key: readonly unknown[], fetchPage: (cursor: string | null) => Promise<{ items: Vod[]; nextCursor: string | null }>, enabled = true) {
  const query = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last?.nextCursor ?? null,
    enabled,
    staleTime: 60_000,
  })
  const items = useMemo<Vod[]>(() => uniqueById(query.data?.pages), [query.data])

  return { ...query, items }
}

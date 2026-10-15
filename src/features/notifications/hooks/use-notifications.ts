import { useCallback } from 'react'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData, type QueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/stores/auth-store'
import { notificationsApi } from '@/features/notifications/api'
import { markAllReadInPages, markReadInPages, removeFromPages, upsertInPages } from '@/features/notifications/lib/center'
import type { AppNotification, NotificationFilter, NotificationPage } from '@/features/notifications/types'
import { useRealtimeStatus } from '@/lib/realtime'

/** Query keys per account, so a sign-out never shows the previous account's items. */
export const notificationKeys = {
  root: (userId: string) => ['notifications', userId] as const,
  unread: (userId: string) => ['notifications', userId, 'unread-count'] as const,
  list: (userId: string, filter: NotificationFilter) => ['notifications', userId, 'list', filter] as const,
}

type Pages = InfiniteData<NotificationPage, string | null>

const FILTERS: NotificationFilter[] = ['all', 'unread']

/** Applies a change to both cached lists (Tất cả, Chưa đọc). */
function updateLists(qc: QueryClient, userId: string, fn: (pages: NotificationPage[], filter: NotificationFilter) => NotificationPage[]) {
  for (const filter of FILTERS) {
    qc.setQueryData<Pages>(notificationKeys.list(userId, filter), (old) => (old ? { ...old, pages: fn(old.pages, filter) } : old))
  }
}

export function upsertNotification(qc: QueryClient, userId: string, n: AppNotification) {
  updateLists(qc, userId, (pages, filter) => upsertInPages(pages, n, filter))
}

export function setUnreadCount(qc: QueryClient, userId: string, count: number) {
  qc.setQueryData(notificationKeys.unread(userId), count)
}

/** True when `id` is already in a cached list (a regroup or a replayed frame). */
export function isKnownNotification(qc: QueryClient, userId: string, id: string): boolean {
  return FILTERS.some((f) => qc.getQueryData<Pages>(notificationKeys.list(userId, f))?.pages.some((p) => p.items.some((i) => i.id === id)) ?? false)
}

function useUserId(): string | null {
  return useAuthStore((s) => (s.status === 'authenticated' ? (s.user?.id ?? null) : null))
}

/** Without a socket the count is asked again every minute (TSD S10). */
const UNREAD_POLL_MS = 60_000

/** Bell count: REST on start, then `unread_count` frames; polled while the socket is down. */
export function useUnreadCount() {
  const userId = useUserId()
  const ws = useRealtimeStatus()

  return useQuery({
    queryKey: notificationKeys.unread(userId ?? 'guest'),
    queryFn: notificationsApi.unreadCount,
    enabled: userId !== null,
    staleTime: 30_000,
    refetchInterval: ws === 'open' ? false : UNREAD_POLL_MS,
  })
}

export function useNotificationList(filter: NotificationFilter, { enabled = true, limit }: { enabled?: boolean; limit?: number } = {}) {
  const userId = useUserId()

  return useInfiniteQuery({
    queryKey: notificationKeys.list(userId ?? 'guest', filter),
    queryFn: ({ pageParam }) => notificationsApi.list(filter, pageParam, limit),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: enabled && userId !== null,
    staleTime: 15_000,
  })
}

/** Read one, read all, delete — optimistic in both lists; the count follows from `unread_count` or a refetch. */
export function useNotificationActions() {
  const qc = useQueryClient()
  const userId = useUserId() ?? 'guest'

  const settle = useCallback(() => {
    void qc.invalidateQueries({ queryKey: notificationKeys.unread(userId) })
  }, [qc, userId])

  const markRead = useMutation({
    mutationFn: (n: AppNotification) => notificationsApi.markRead(n.id),
    onMutate: (n) => {
      if (n.read) return
      updateLists(qc, userId, (pages, filter) => markReadInPages(pages, n.id, filter))
      qc.setQueryData<number>(notificationKeys.unread(userId), (c) => (typeof c === 'number' ? Math.max(0, c - 1) : c))
    },
    onSettled: settle,
  })

  const markAllRead = useMutation({
    mutationFn: (before: string) => notificationsApi.markAllRead(before),
    onMutate: (before) => {
      updateLists(qc, userId, (pages, filter) => markAllReadInPages(pages, before, filter))
      qc.setQueryData(notificationKeys.unread(userId), 0)
    },
    onSettled: settle,
  })

  const remove = useMutation({
    mutationFn: (n: AppNotification) => notificationsApi.remove(n.id),
    onMutate: (n) => {
      updateLists(qc, userId, (pages) => removeFromPages(pages, n.id))
      if (!n.read) qc.setQueryData<number>(notificationKeys.unread(userId), (c) => (typeof c === 'number' ? Math.max(0, c - 1) : c))
    },
    onError: () => void qc.invalidateQueries({ queryKey: notificationKeys.root(userId) }),
    onSettled: settle,
  })

  return { markRead, markAllRead, remove }
}

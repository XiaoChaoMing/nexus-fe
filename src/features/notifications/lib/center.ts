import type { AppNotification, NotificationFilter, NotificationPage } from '@/features/notifications/types'

/**
 * Notification center bookkeeping, pure so it is unit-tested: realtime upserts into the cached pages (NXL-E
 * §13.3: the client upserts by id, a grouped item moves to the top and becomes unread again), read / delete
 * locally, groups by age, and when a live toast may show.
 */

function newestFirst(a: AppNotification, b: AppNotification): number {
  return b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id)
}

/** Inserts or replaces `n`, keeping the first page sorted; the unread list drops items that are read. */
export function upsertInPages(pages: readonly NotificationPage[], n: AppNotification, filter: NotificationFilter): NotificationPage[] {
  const without = pages.map((p) => ({ ...p, items: p.items.filter((i) => i.id !== n.id) }))
  if (filter === 'unread' && n.read) return without
  if (without.length === 0) return [{ items: [n], nextCursor: null }]
  const [first, ...rest] = without

  return [{ ...first, items: [...first.items, n].sort(newestFirst) }, ...rest]
}

export function markReadInPages(pages: readonly NotificationPage[], id: string, filter: NotificationFilter): NotificationPage[] {
  return pages.map((p) => ({
    ...p,
    items: filter === 'unread' ? p.items.filter((i) => i.id !== id) : p.items.map((i) => (i.id === id ? { ...i, read: true } : i)),
  }))
}

/** "Đánh dấu tất cả đã đọc" reads what was there at `before` (TSD S10). */
export function markAllReadInPages(pages: readonly NotificationPage[], before: string, filter: NotificationFilter): NotificationPage[] {
  return pages.map((p) => ({
    ...p,
    items: p.items.flatMap((i) => {
      if (i.updatedAt > before) return [i]

      return filter === 'unread' ? [] : [{ ...i, read: true }]
    }),
  }))
}

export function removeFromPages(pages: readonly NotificationPage[], id: string): NotificationPage[] {
  return pages.map((p) => ({ ...p, items: p.items.filter((i) => i.id !== id) }))
}

export type AgeGroup = 'today' | 'yesterday' | 'week' | 'older'

function dayStart(ms: number): number {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)

  return d.getTime()
}

/** Hôm nay / Hôm qua / 7 ngày qua / Cũ hơn by the viewer's local calendar day. */
export function ageGroup(iso: string, now: number): AgeGroup {
  const today = dayStart(now)
  const at = Date.parse(iso)
  if (at >= today) return 'today'
  const yesterday = dayStart(today - 1)
  if (at >= yesterday) return 'yesterday'
  if (at >= dayStart(today - 6 * 86_400_000)) return 'week'

  return 'older'
}

export function groupByAge(items: readonly AppNotification[], now: number): { group: AgeGroup; items: AppNotification[] }[] {
  const out: { group: AgeGroup; items: AppNotification[] }[] = []
  for (const n of items) {
    const group = ageGroup(n.updatedAt, now)
    const last = out.at(-1)
    if (last?.group === group) last.items.push(n)
    else out.push({ group, items: [n] })
  }

  return out
}

/** At most one live toast per this window (NXL-E, design 23b); later ones only move the bell. */
export const TOAST_WINDOW_MS = 10_000
/** A notification older than this when it arrives (a replay after reconnecting) is not toasted. */
export const TOAST_FRESH_MS = 120_000

export type ToastInput = {
  n: AppNotification
  now: number
  lastToastAt: number | null
  /** Current path: no toast for the broadcast being watched. */
  pathname: string
  /** Ids already toasted or already listed (a regroup of a known item is not a new event). */
  known: boolean
}

export function shouldToast({ n, now, lastToastAt, pathname, known }: ToastInput): boolean {
  if (known || n.read) return false
  const p = n.payload
  if (p.type !== 'CREATOR_LIVE' && p.type !== 'STREAM_STARTING') return false
  if (now - Date.parse(n.createdAt) > TOAST_FRESH_MS) return false
  if (lastToastAt !== null && now - lastToastAt < TOAST_WINDOW_MS) return false
  if (p.type === 'CREATOR_LIVE' && p.streamId && pathname === `/live/${p.streamId}`) return false

  return true
}

/** Minutes until a scheduled start, as told when the reminder was created ("sẽ phát sau 10 phút"). */
export function minutesUntil(occurrenceAt: string | null, createdAt: string): number {
  if (!occurrenceAt) return 10
  const min = Math.round((Date.parse(occurrenceAt) - Date.parse(createdAt)) / 60_000)

  return Math.max(1, min)
}

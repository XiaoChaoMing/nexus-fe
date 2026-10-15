import { apiRequest } from '@/lib/api-client'
import { parseCount, parseNotificationPage, parseSettings, parseUnsubscribed } from '@/features/notifications/lib/parse'
import type { NotificationFilter, NotificationPage, NotificationSettings, NotificationType } from '@/features/notifications/types'

const enc = encodeURIComponent

/** Items per page of the center (`limit` 1–50, default 20). */
export const NOTIFICATION_PAGE_SIZE = 20

/** notification-svc (TSD GĐ5 §5.5) through the edge. */
export const notificationsApi = {
  list: async (filter: NotificationFilter, cursor: string | null, limit = NOTIFICATION_PAGE_SIZE): Promise<NotificationPage> => {
    const q = new URLSearchParams({ limit: String(limit) })
    if (filter === 'unread') q.set('unread', 'true')
    if (cursor) q.set('cursor', cursor)

    return parseNotificationPage(await apiRequest<unknown>(`/v1/notifications?${q}`, { auth: true }))
  },
  unreadCount: async (): Promise<number> => parseCount(await apiRequest<unknown>('/v1/notifications/unread-count', { auth: true })),
  markRead: (id: string) => apiRequest<void>(`/v1/notifications/${enc(id)}/read`, { method: 'POST', auth: true }),
  markAllRead: (before: string) => apiRequest<void>('/v1/notifications/read-all', { method: 'POST', body: { before }, auth: true }),
  remove: (id: string) => apiRequest<void>(`/v1/notifications/${enc(id)}`, { method: 'DELETE', auth: true }),
  settings: async (): Promise<NotificationSettings> => parseSettings(await apiRequest<unknown>('/v1/me/notification-settings', { auth: true })),
  updateSettings: async (items: { type: NotificationType; inApp?: boolean; email?: boolean }[]): Promise<NotificationSettings> =>
    parseSettings(await apiRequest<unknown>('/v1/me/notification-settings', { method: 'PUT', body: { items }, auth: true })),
  /** No account needed: the token names the user and the type. */
  unsubscribe: async (token: string): Promise<NotificationType | null> =>
    parseUnsubscribed(await apiRequest<unknown>('/v1/notifications/unsubscribe', { method: 'POST', body: { token } })),
}

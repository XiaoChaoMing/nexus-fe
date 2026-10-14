import { apiRequest } from '@/lib/api-client'
import type { ChannelProfileFull, FollowedChannel, FollowState, NotifyLevel, Occurrence, Page, Reminder, SidebarFollowing } from '@/features/channels/types'

const enc = encodeURIComponent

/** channel-svc: profiles, follows, schedules and reminders (TSD GĐ4 §5.2). */
export const channelsApi = {
  /** Token optional: with one, `viewer` says whether this account follows (and owns) the channel. */
  profile: (handle: string) => apiRequest<ChannelProfileFull>(`/v1/channels/${enc(handle)}`, { auth: true }),
  follow: (channelId: string) => apiRequest<FollowState>(`/v1/channels/${enc(channelId)}/follow`, { method: 'POST', auth: true }),
  setNotifyLevel: (channelId: string, notifyLevel: NotifyLevel) =>
    apiRequest<FollowState>(`/v1/channels/${enc(channelId)}/follow`, { method: 'PUT', body: { notifyLevel }, auth: true }),
  unfollow: (channelId: string) => apiRequest<void>(`/v1/channels/${enc(channelId)}/follow`, { method: 'DELETE', auth: true }),
  following: (status: 'live' | 'all', cursor?: string | null, limit = 24) =>
    apiRequest<Page<FollowedChannel>>(`/v1/me/following?status=${status}&limit=${limit}${cursor ? `&cursor=${enc(cursor)}` : ''}`, { auth: true }),
  sidebar: () => apiRequest<SidebarFollowing>('/v1/me/following/sidebar', { auth: true }),
  /** Broadcasts in `[from, to]` (default: the next 14 days); `reminded` is filled with a token. */
  schedule: (channelId: string, range: { from?: string; to?: string } = {}) => {
    const sp = new URLSearchParams()
    if (range.from) sp.set('from', range.from)
    if (range.to) sp.set('to', range.to)
    const qs = sp.toString()

    return apiRequest<{ items: Occurrence[] }>(`/v1/channels/${enc(channelId)}/schedule${qs ? `?${qs}` : ''}`, { auth: true })
  },
  remind: (scheduleId: string, occurrenceAt: string) =>
    apiRequest<Reminder>(`/v1/schedules/${enc(scheduleId)}/reminders`, { method: 'POST', body: { occurrenceAt }, auth: true }),
  unremind: (scheduleId: string, occurrenceAt: string) =>
    apiRequest<void>(`/v1/schedules/${enc(scheduleId)}/reminders?occurrenceAt=${enc(occurrenceAt)}`, { method: 'DELETE', auth: true }),
}

import { apiRequest } from '@/lib/api-client'
import type { ChannelPatch, ChannelStats, Dashboard, Schedule, ScheduleInput, StatsRange, StudioChannel, StudioVod, VodVisibility } from '@/features/studio/types'

const enc = encodeURIComponent

export type ImageKind = 'avatar' | 'banner'

/** Studio APIs of GĐ4: channel-svc (`/v1/studio/channel*`, `/v1/studio/schedules*`), stream-svc (dashboard, VODs). */
export const studioV4Api = {
  channel: () => apiRequest<StudioChannel>('/v1/studio/channel', { auth: true }),
  updateChannel: (patch: ChannelPatch) => apiRequest<StudioChannel>('/v1/studio/channel', { method: 'PATCH', body: patch, auth: true }),
  uploadImage: (kind: ImageKind, file: File) => {
    const form = new FormData()
    form.append('file', file)

    return apiRequest<{ url: string }>(`/v1/studio/channel/${kind}`, { method: 'PUT', body: form, auth: true })
  },
  stats: (range: StatsRange) => apiRequest<ChannelStats>(`/v1/studio/channel/stats?range=${range}`, { auth: true }),
  dashboard: (range: StatsRange) => apiRequest<Dashboard>(`/v1/studio/dashboard?range=${range}`, { auth: true }),

  vods: (filter: { visibility?: VodVisibility; status?: 'READY' | 'EXPIRED' }, cursor?: string | null) => {
    const sp = new URLSearchParams({ limit: '24' })
    if (filter.visibility) sp.set('visibility', filter.visibility)
    if (filter.status) sp.set('status', filter.status)
    if (cursor) sp.set('cursor', cursor)

    return apiRequest<{ items: StudioVod[]; nextCursor: string | null }>(`/v1/studio/vods?${sp.toString()}`, { auth: true })
  },
  updateVod: (id: string, patch: { title?: string; visibility?: VodVisibility }) =>
    apiRequest<StudioVod>(`/v1/studio/vods/${enc(id)}`, { method: 'PATCH', body: patch, auth: true }),
  deleteVod: (id: string) => apiRequest<void>(`/v1/studio/vods/${enc(id)}`, { method: 'DELETE', auth: true }),

  schedules: (status: 'ACTIVE' | 'CANCELLED' = 'ACTIVE') =>
    apiRequest<{ items: Schedule[] }>(`/v1/studio/schedules?status=${status}`, { auth: true }),
  createSchedule: (input: ScheduleInput) => apiRequest<Schedule>('/v1/studio/schedules', { method: 'POST', body: input, auth: true }),
  updateSchedule: (id: string, input: ScheduleInput) => apiRequest<Schedule>(`/v1/studio/schedules/${enc(id)}`, { method: 'PUT', body: input, auth: true }),
  cancelSchedule: (id: string) => apiRequest<void>(`/v1/studio/schedules/${enc(id)}`, { method: 'DELETE', auth: true }),
  moveOccurrence: (id: string, occurrenceAt: string, startAt: string) =>
    apiRequest<{ schedule: Schedule }>(`/v1/studio/schedules/${enc(id)}/occurrences/${enc(occurrenceAt)}`, { method: 'PUT', body: { startAt }, auth: true }),
  cancelOccurrence: (id: string, occurrenceAt: string) =>
    apiRequest<void>(`/v1/studio/schedules/${enc(id)}/occurrences/${enc(occurrenceAt)}`, { method: 'DELETE', auth: true }),
}

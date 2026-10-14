import { apiRequest } from '@/lib/api-client'
import type { PlaybackRequest } from '@/features/streams/lib/playback'
import type {
  ContinueWatchingItem,
  Playback,
  SettingsInput,
  StreamKeyCreated,
  StreamKeyInfo,
  StreamList,
  StreamSettings,
  StreamDetail,
  Studio,
  Vod,
  VodList,
} from '@/features/streams/types'

const enc = encodeURIComponent

export type PlaybackKind = 'stream' | 'vod'

/** Filters of `GET /v1/streams` (TSD GĐ4 §5.3). `categories: []` means a group without categories: nothing matches. */
export type LiveFilter = {
  categories?: string[] | null
  language?: string | null
  tags?: string[]
  sort?: 'viewers' | 'newest'
  limit?: number
}

function query(params: Record<string, string | number | null | undefined>): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined && v !== '') sp.set(k, String(v))

  return sp.toString()
}

export const streamsApi = {
  listLive: (cursor?: string) => apiRequest<StreamList>(`/v1/streams?status=live${cursor ? `&cursor=${enc(cursor)}` : ''}`),
  /** Live (and interrupted) streams, filtered; the server sorts by viewers unless told otherwise. */
  list: (f: LiveFilter, cursor?: string | null) =>
    apiRequest<StreamList>(
      `/v1/streams?${query({
        status: 'live',
        category: f.categories?.join(','),
        language: f.language,
        tags: f.tags?.join(','),
        sort: f.sort,
        limit: f.limit,
        cursor,
      })}`,
    ),
  /** Hero, "Kênh trực tiếp đề xuất", guest sidebar: LIVE only, no 18+, by viewers (G4-Q4). */
  recommended: (limit: number) => apiRequest<StreamList>(`/v1/streams/recommended?limit=${limit}`),
  /** Token optional: the channel owner also sees the id of a hidden VOD. Upcoming broadcasts come back too. */
  get: (id: string) => apiRequest<StreamDetail>(`/v1/streams/${enc(id)}`, { auth: true }),
  vods: (f: { category?: string | null; limit?: number }, cursor?: string | null) =>
    apiRequest<VodList>(`/v1/vods?${query({ category: f.category, limit: f.limit, cursor })}`),
  recommendedVods: (limit: number) => apiRequest<VodList>(`/v1/vods/recommended?limit=${limit}`),
  channelVods: (channelId: string, cursor?: string | null, limit = 24) =>
    apiRequest<VodList>(`/v1/channels/${enc(channelId)}/vods?${query({ limit, cursor })}`),
  /** With a token the VOD carries `viewer.positionSec`. */
  getVod: (id: string) => apiRequest<Vod>(`/v1/vods/${enc(id)}`, { auth: true }),
  /** Opens a playback session; the Bearer token is optional (guests send `X-NXL-Anon-Id`). */
  openPlayback: (kind: PlaybackKind, id: string, req: PlaybackRequest) =>
    apiRequest<Playback>(`/v1/${kind === 'stream' ? 'streams' : 'vods'}/${enc(id)}/playback`, {
      method: 'POST',
      body: req.body,
      headers: req.headers,
      auth: true,
    }),
}

export const viewerApi = {
  saveProgress: (vodId: string, body: { positionSec: number; keepFurther?: boolean }, opts: { keepalive?: boolean } = {}) =>
    apiRequest<void>(`/v1/me/watch-progress/${enc(vodId)}`, { method: 'PUT', body, auth: true, keepalive: opts.keepalive }),
  continueWatching: (limit = 12) =>
    apiRequest<{ items: ContinueWatchingItem[] }>(`/v1/me/continue-watching?limit=${limit}`, { auth: true }),
}

export const studioApi = {
  keyInfo: () => apiRequest<StreamKeyInfo>('/v1/studio/stream-key', { auth: true }),
  createKey: () => apiRequest<StreamKeyCreated>('/v1/studio/stream-key', { method: 'POST', auth: true }),
  overview: () => apiRequest<Studio>('/v1/studio/stream', { auth: true }),
  updateSettings: (input: SettingsInput) =>
    apiRequest<StreamSettings>('/v1/studio/stream', { method: 'PUT', body: input, auth: true }),
  end: () => apiRequest<void>('/v1/studio/stream/end', { method: 'POST', auth: true }),
}

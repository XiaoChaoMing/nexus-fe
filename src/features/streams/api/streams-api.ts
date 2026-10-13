import { apiRequest } from '@/lib/api-client'
import type { PlaybackRequest } from '@/features/streams/lib/playback'
import type {
  ChannelProfile,
  ContinueWatchingItem,
  Playback,
  SettingsInput,
  Stream,
  StreamKeyCreated,
  StreamKeyInfo,
  StreamList,
  StreamSettings,
  Studio,
  Vod,
} from '@/features/streams/types'

const enc = encodeURIComponent

export type PlaybackKind = 'stream' | 'vod'

export const streamsApi = {
  listLive: (cursor?: string) => apiRequest<StreamList>(`/v1/streams?status=live${cursor ? `&cursor=${enc(cursor)}` : ''}`),
  get: (id: string) => apiRequest<Stream>(`/v1/streams/${enc(id)}`),
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

export const channelsApi = {
  get: (handle: string) => apiRequest<ChannelProfile>(`/v1/channels/${enc(handle)}`),
}

export const studioApi = {
  keyInfo: () => apiRequest<StreamKeyInfo>('/v1/studio/stream-key', { auth: true }),
  createKey: () => apiRequest<StreamKeyCreated>('/v1/studio/stream-key', { method: 'POST', auth: true }),
  overview: () => apiRequest<Studio>('/v1/studio/stream', { auth: true }),
  updateSettings: (input: SettingsInput) =>
    apiRequest<StreamSettings>('/v1/studio/stream', { method: 'PUT', body: input, auth: true }),
  end: () => apiRequest<void>('/v1/studio/stream/end', { method: 'POST', auth: true }),
}

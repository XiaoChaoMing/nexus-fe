import { apiRequest } from '@/lib/api-client'
import type {
  SettingsInput,
  Stream,
  StreamKeyCreated,
  StreamKeyInfo,
  StreamList,
  StreamSettings,
  Studio,
  Vod,
} from '@/features/streams/types'

export const streamsApi = {
  listLive: (cursor?: string) =>
    apiRequest<StreamList>(`/v1/streams?status=live${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`),
  get: (id: string) => apiRequest<Stream>(`/v1/streams/${encodeURIComponent(id)}`),
  getVod: (id: string) => apiRequest<Vod>(`/v1/vods/${encodeURIComponent(id)}`),
}

export const studioApi = {
  keyInfo: () => apiRequest<StreamKeyInfo>('/v1/studio/stream-key', { auth: true }),
  createKey: () => apiRequest<StreamKeyCreated>('/v1/studio/stream-key', { method: 'POST', auth: true }),
  overview: () => apiRequest<Studio>('/v1/studio/stream', { auth: true }),
  updateSettings: (input: SettingsInput) =>
    apiRequest<StreamSettings>('/v1/studio/stream', { method: 'PUT', body: input, auth: true }),
  end: () => apiRequest<void>('/v1/studio/stream/end', { method: 'POST', auth: true }),
}

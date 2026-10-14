import { apiRequest } from '@/lib/api-client'
import { CHAT_LIMITS } from '@/features/chat/lib/constants'
import { parseEmotes, parseHistory, parseSettings } from '@/features/chat/lib/parse'
import type { ChatMessage, ChatMode, ChatSettings, Emote } from '@/features/chat/types'

const enc = encodeURIComponent

/** chat-svc REST (TSD GĐ3 §5.2), through the same origin as the rest of `/v1`. */
export const chatApi = {
  /** The latest messages, oldest first in the result. */
  history: async (streamId: string, limit: number = CHAT_LIMITS.historyOnJoin): Promise<ChatMessage[]> =>
    parseHistory(await apiRequest<unknown>(`/v1/chat/rooms/${enc(streamId)}/messages?limit=${limit}`)),
  emotes: async (): Promise<Emote[]> => parseEmotes(await apiRequest<unknown>('/v1/chat/emotes')),
  settings: async (channelId: string): Promise<ChatSettings> => parseSettings(await apiRequest<unknown>(`/v1/channels/${enc(channelId)}/chat-settings`)),
  updateSettings: async (channelId: string, mode: ChatMode): Promise<ChatSettings> =>
    parseSettings(await apiRequest<unknown>(`/v1/channels/${enc(channelId)}/chat-settings`, { method: 'PUT', body: mode, auth: true })),
}

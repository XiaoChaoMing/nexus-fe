import { apiRequest } from '@/lib/api-client'
import { parseMessage } from '@/features/chat/lib/parse'
import type { ChatMessage } from '@/features/chat/types'
import {
  parseBlockIds,
  parseBlocks,
  parseCard,
  parseModChannels,
  parseRestriction,
  parseRestrictions,
  parseRole,
  parseRoles,
  parseTerm,
  parseTerms,
} from '@/features/moderation/lib/parse'
import type { Block, BlockedTerm, ChannelRole, ChannelRoleName, ModChannel, Page, ReportReason, Restriction, RestrictionType, UserCard } from '@/features/moderation/types'

const enc = encodeURIComponent

function cursorQuery(params: Record<string, string | null | undefined>): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v)
  const s = q.toString()

  return s ? `?${s}` : ''
}

/** chat-svc moderation and roles (TSD GĐ5 §5.2). */
export const modApi = {
  deleteMessage: (streamId: string, messageId: string) => apiRequest<void>(`/v1/chat/rooms/${enc(streamId)}/messages/${enc(messageId)}`, { method: 'DELETE', auth: true }),
  pin: async (streamId: string, messageId: string): Promise<ChatMessage | null> => {
    const r = await apiRequest<{ message?: unknown } | null>(`/v1/chat/rooms/${enc(streamId)}/pin`, { method: 'PUT', body: { messageId }, auth: true })

    return parseMessage(r?.message)
  },
  unpin: (streamId: string) => apiRequest<void>(`/v1/chat/rooms/${enc(streamId)}/pin`, { method: 'DELETE', auth: true }),
  timeout: async (channelId: string, userId: string, durationSec: number, reason?: string): Promise<Restriction | null> =>
    parseRestriction(await apiRequest<unknown>(`/v1/channels/${enc(channelId)}/timeouts/${enc(userId)}`, { method: 'PUT', body: { durationSec, ...(reason ? { reason } : {}) }, auth: true })),
  untimeout: (channelId: string, userId: string) => apiRequest<void>(`/v1/channels/${enc(channelId)}/timeouts/${enc(userId)}`, { method: 'DELETE', auth: true }),
  ban: async (channelId: string, userId: string, reason?: string): Promise<Restriction | null> =>
    parseRestriction(await apiRequest<unknown>(`/v1/channels/${enc(channelId)}/bans/${enc(userId)}`, { method: 'PUT', body: reason ? { reason } : {}, auth: true })),
  unban: (channelId: string, userId: string) => apiRequest<void>(`/v1/channels/${enc(channelId)}/bans/${enc(userId)}`, { method: 'DELETE', auth: true }),
  restrictions: async (channelId: string, type: RestrictionType | null, cursor: string | null): Promise<Page<Restriction>> =>
    parseRestrictions(await apiRequest<unknown>(`/v1/channels/${enc(channelId)}/restrictions${cursorQuery({ type, cursor, limit: '50' })}`, { auth: true })),
  card: async (channelId: string, userId: string): Promise<UserCard> => {
    const card = parseCard(await apiRequest<unknown>(`/v1/channels/${enc(channelId)}/users/${enc(userId)}/card`, { auth: true }))
    if (!card) throw new Error('empty user card')

    return card
  },
  terms: async (channelId: string): Promise<{ items: BlockedTerm[]; limit: number }> => parseTerms(await apiRequest<unknown>(`/v1/channels/${enc(channelId)}/blocked-terms`, { auth: true })),
  addTerm: async (channelId: string, term: string): Promise<BlockedTerm | null> =>
    parseTerm(await apiRequest<unknown>(`/v1/channels/${enc(channelId)}/blocked-terms`, { method: 'POST', body: { term }, auth: true })),
  removeTerm: (channelId: string, termId: string) => apiRequest<void>(`/v1/channels/${enc(channelId)}/blocked-terms/${enc(termId)}`, { method: 'DELETE', auth: true }),
  roles: async (channelId: string, role: ChannelRoleName, cursor: string | null): Promise<Page<ChannelRole>> =>
    parseRoles(await apiRequest<unknown>(`/v1/channels/${enc(channelId)}/roles${cursorQuery({ role, cursor, limit: '50' })}`, { auth: true })),
  addRole: async (channelId: string, username: string, role: ChannelRoleName): Promise<ChannelRole | null> =>
    parseRole(await apiRequest<unknown>(`/v1/channels/${enc(channelId)}/roles`, { method: 'POST', body: { username, role }, auth: true })),
  setRole: async (channelId: string, userId: string, role: ChannelRoleName): Promise<ChannelRole | null> =>
    parseRole(await apiRequest<unknown>(`/v1/channels/${enc(channelId)}/roles/${enc(userId)}`, { method: 'PUT', body: { role }, auth: true })),
  removeRole: (channelId: string, userId: string) => apiRequest<void>(`/v1/channels/${enc(channelId)}/roles/${enc(userId)}`, { method: 'DELETE', auth: true }),
  myChannelRoles: async (): Promise<ModChannel[]> => parseModChannels(await apiRequest<unknown>('/v1/me/channel-roles', { auth: true })),
}

/** identity blocks (TSD GĐ5 §5.3). */
export const blocksApi = {
  ids: async (): Promise<string[]> => parseBlockIds(await apiRequest<unknown>('/v1/me/blocks?fields=ids', { auth: true })),
  list: async (cursor: string | null): Promise<Page<Block>> => parseBlocks(await apiRequest<unknown>(`/v1/me/blocks${cursorQuery({ cursor, limit: '50' })}`, { auth: true })),
  block: (userId: string) => apiRequest<void>(`/v1/me/blocks/${enc(userId)}`, { method: 'PUT', auth: true }),
  unblock: (userId: string) => apiRequest<void>(`/v1/me/blocks/${enc(userId)}`, { method: 'DELETE', auth: true }),
}

export type ReportRequest = { targetType: 'USER' | 'CHANNEL' | 'STREAM' | 'MESSAGE'; targetId: string; reason: ReportReason; note?: string; streamId?: string }

/** safety-svc (TSD GĐ5 §5.4): a duplicate open report answers 200 with the same id. */
export const reportsApi = {
  create: (body: ReportRequest) => apiRequest<{ id: string; status: string; createdAt: string }>('/v1/reports', { method: 'POST', body, auth: true }),
}

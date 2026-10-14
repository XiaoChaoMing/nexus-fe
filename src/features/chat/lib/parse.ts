import type {
  ChatBadge,
  ChatMe,
  ChatMessage,
  ChatMode,
  ChatRole,
  ChatRoomState,
  ChatSettings,
  ChatSnapshot,
  ChatUser,
  Emote,
  Fragment,
  RoomStatus,
} from '@/features/chat/types'
import type { IncomingEvent } from '@/features/chat/lib/chat-state'

/**
 * Chat payloads (REST and WebSocket) are untrusted: these turn them into the app's types, dropping what does not
 * fit instead of throwing. Text is kept as plain strings; nothing here is ever rendered as HTML (BR05).
 */

type Rec = Record<string, unknown>

function isRec(v: unknown): v is Rec {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

function strOrNull(v: unknown): string | null {
  return typeof v === 'string' && v !== '' ? v : null
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

const BADGES: readonly ChatBadge[] = ['STREAMER', 'MODERATOR', 'VIP', 'SUB_T1', 'SUB_T2', 'SUB_T3', 'VERIFIED']
const BADGE_ALIASES: Record<string, ChatBadge> = {
  BROADCASTER: 'STREAMER',
  OWNER: 'STREAMER',
  CREATOR: 'STREAMER',
  MOD: 'MODERATOR',
  SUBSCRIBER: 'SUB_T1',
  SUB: 'SUB_T1',
  SUB_TIER1: 'SUB_T1',
  SUB_TIER2: 'SUB_T2',
  SUB_TIER3: 'SUB_T3',
}

export function parseBadge(v: unknown): ChatBadge | null {
  if (typeof v !== 'string') return null
  const up = v.toUpperCase()
  if ((BADGES as readonly string[]).includes(up)) return up as ChatBadge

  return BADGE_ALIASES[up] ?? null
}

function parseBadges(v: unknown): ChatBadge[] {
  if (!Array.isArray(v)) return []
  const out: ChatBadge[] = []
  for (const b of v) {
    const badge = parseBadge(b)
    if (badge && !out.includes(badge)) out.push(badge)
  }

  return out
}

const ROLES: readonly ChatRole[] = ['STREAMER', 'MODERATOR', 'ADMIN', 'VIP', 'SUBSCRIBER', 'VIEWER', 'GUEST']
const ROLE_ALIASES: Record<string, ChatRole> = { BROADCASTER: 'STREAMER', OWNER: 'STREAMER', CREATOR: 'STREAMER', MOD: 'MODERATOR', USER: 'VIEWER' }

export function parseRole(v: unknown): ChatRole {
  if (typeof v !== 'string') return 'VIEWER'
  const up = v.toUpperCase()
  if ((ROLES as readonly string[]).includes(up)) return up as ChatRole

  return ROLE_ALIASES[up] ?? 'VIEWER'
}

const HEX = /^#[0-9a-f]{6}$/i

function parseColor(v: unknown): string | null {
  return typeof v === 'string' && HEX.test(v) ? v.toUpperCase() : null
}

/** Only same-origin paths and http(s) URLs are used as image sources. */
export function safeImageUrl(v: unknown): string | null {
  if (typeof v !== 'string' || v.length === 0 || v.length > 2048) return null
  if (v.startsWith('/') && !v.startsWith('//')) return v

  return /^https?:\/\//i.test(v) ? v : null
}

export function parseMode(v: unknown): ChatMode {
  const r = isRec(v) ? v : {}
  const slow = num(r.slowSec)
  const followers = num(r.followersMin)

  return {
    slowSec: slow !== null && slow > 0 ? Math.round(slow) : 0,
    followersMin: followers !== null && followers >= 0 ? Math.round(followers) : null,
    subsOnly: r.subsOnly === true,
  }
}

const STATUSES: readonly RoomStatus[] = ['OPEN', 'READ_ONLY', 'CLOSED', 'NOT_OPEN']

export function parseRoomStatus(v: unknown): RoomStatus | null {
  return typeof v === 'string' && (STATUSES as readonly string[]).includes(v.toUpperCase()) ? (v.toUpperCase() as RoomStatus) : null
}

function parseRoom(v: unknown): ChatRoomState {
  const r = isRec(v) ? v : {}

  return { status: parseRoomStatus(r.status) ?? 'OPEN', mode: parseMode(r.mode) }
}

function parseMe(v: unknown): ChatMe | null {
  if (!isRec(v)) return null
  const details = isRec(v.details) ? v.details : {}

  return {
    role: parseRole(v.role),
    badges: parseBadges(v.badges),
    color: parseColor(v.color),
    canSend: v.canSend === true,
    reason: strOrNull(v.reason),
    retryAfterSec: num(v.retryAfterSec) ?? num(details.retryAfterSec),
    until: strOrNull(v.until) ?? strOrNull(details.until),
    requiredMin: num(v.requiredMin) ?? num(details.requiredMin),
  }
}

/** `subscribed.snapshot` of `chat:{streamId}`. */
export function parseChatSnapshot(v: unknown): ChatSnapshot {
  const r = isRec(v) ? v : {}

  return { room: parseRoom(r.room), me: parseMe(r.me) }
}

function parseFragment(v: unknown): Fragment | null {
  if (!isRec(v)) return null
  const text = str(v.text)
  if (v.type === 'emote' && isRec(v.emote)) {
    const imageUrl = safeImageUrl(v.emote.imageUrl ?? v.emote.url)
    const code = str(v.emote.code, text)
    if (imageUrl && code) return { type: 'emote', text: text || code, emote: { id: str(v.emote.id, code), code, imageUrl } }

    return { type: 'text', text: text || code }
  }
  if (v.type === 'mention') return text ? { type: 'mention', text, userId: strOrNull(v.userId) } : null

  return text ? { type: 'text', text } : null
}

function parseUser(v: unknown): ChatUser | null {
  if (!isRec(v)) return null
  const id = str(v.id)
  const username = str(v.username)
  if (!id) return null

  return {
    id,
    username,
    displayName: str(v.displayName) || username || id.slice(0, 8),
    color: parseColor(v.color),
    badges: parseBadges(v.badges),
  }
}

const SYSTEM_USER: ChatUser = { id: 'system', username: '', displayName: '', color: null, badges: [] }

/** One message (`message` event data or a history item). Null when it has no id. */
export function parseMessage(v: unknown): ChatMessage | null {
  if (!isRec(v)) return null
  const id = str(v.id)
  if (!id) return null
  const type = str(v.type).toUpperCase() === 'NORMAL' || !v.type ? 'NORMAL' : 'SYSTEM'
  const user = parseUser(v.user) ?? (type === 'SYSTEM' ? SYSTEM_USER : null)
  if (!user) return null
  const body = str(v.body)
  const fragments = Array.isArray(v.fragments) ? v.fragments.map(parseFragment).filter((f): f is Fragment => f !== null) : []
  const flags = isRec(v.flags) ? v.flags : {}

  return {
    id,
    streamId: str(v.streamId),
    user,
    body,
    fragments: fragments.length > 0 ? fragments : body ? [{ type: 'text', text: body }] : [],
    type,
    createdAt: str(v.createdAt),
    deleted: v.deleted === true || flags.deleted === true || typeof v.deletedAt === 'string',
    clientMsgId: strOrNull(v.clientMsgId),
  }
}

/** `GET /v1/chat/rooms/{streamId}/messages`: newest first on the wire, returned oldest first. */
export function parseHistory(v: unknown): ChatMessage[] {
  const r = isRec(v) ? v : {}
  const items = Array.isArray(r.items) ? r.items : Array.isArray(r.messages) ? r.messages : []

  return items
    .map(parseMessage)
    .filter((m): m is ChatMessage => m !== null)
    .reverse()
}

export function parseEmotes(v: unknown): Emote[] {
  const r = isRec(v) ? v : {}
  const items = Array.isArray(r.items) ? r.items : []
  const out: Emote[] = []
  for (const e of items) {
    if (!isRec(e)) continue
    const code = str(e.code)
    const imageUrl = safeImageUrl(e.imageUrl ?? e.url)
    if (!code || !imageUrl) continue
    out.push({ id: str(e.id, code), code, imageUrl, animated: e.animated === true, scope: e.scope === 'CHANNEL' ? 'CHANNEL' : 'GLOBAL' })
  }

  return out
}

export function parseSettings(v: unknown): ChatSettings {
  const r = isRec(v) ? v : {}

  return { ...parseMode(r), updatedAt: strOrNull(r.updatedAt) }
}

/** `system` event: `{type, text, meta}` (NXL-B §13). */
export function parseSystemEvent(v: unknown): { kind: string; text: string } | null {
  if (!isRec(v)) return null
  const text = str(v.text)

  return text ? { kind: str(v.type ?? v.kind).toLowerCase(), text } : null
}

/** Kinds of `system` events the client already renders itself (from `mode_change`). */
const LOCAL_SYSTEM_KINDS = new Set(['mode_change', 'mode', 'chat_mode'])

/** One `event` frame of `chat:{streamId}` → what the room state understands; null for unknown/invalid ones. */
export function parseChatEvent(type: string, data: unknown): IncomingEvent | null {
  switch (type) {
    case 'message': {
      const message = parseMessage(data)

      return message ? { type: 'message', message } : null
    }
    case 'ack': {
      const r = isRec(data) ? data : {}
      const clientMsgId = str(r.clientMsgId)
      const messageId = str(r.messageId)

      return clientMsgId && messageId ? { type: 'ack', clientMsgId, messageId } : null
    }
    case 'system': {
      const sys = parseSystemEvent(data)

      return sys && !LOCAL_SYSTEM_KINDS.has(sys.kind) ? { type: 'system', text: sys.text } : null
    }
    case 'mode_change':
      return { type: 'mode_change', mode: parseMode(isRec(data) && isRec(data.mode) ? data.mode : data) }
    case 'room_state': {
      const status = parseRoomStatus(isRec(data) ? data.status : null)

      return status ? { type: 'room_state', status } : null
    }
    case 'sampling':
      return { type: 'sampling', active: isRec(data) && data.active === true }
    default:
      return null
  }
}

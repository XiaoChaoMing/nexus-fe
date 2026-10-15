/** Chat shapes from chat-svc (TSD GĐ3 §5.1–5.2, NXL-B §8, §13). Parsed from untrusted JSON in `lib/parse.ts`. */

/** ChatRoom (NXL-B §7A). `NOT_OPEN` is never stored by chat-svc in GĐ3 but is accepted. */
export type RoomStatus = 'OPEN' | 'READ_ONLY' | 'CLOSED' | 'NOT_OPEN'

export type ChatMode = {
  /** 0 = off; one of 2, 5, 10, 30, 60, 120. */
  slowSec: number
  /** null = off; minutes of following required (0 = any follower). */
  followersMin: number | null
  subsOnly: boolean
  /** GĐ5: links are refused (`CHAT_CONTENT_BLOCKED`, reason LINK) for people other than the owner, Mods and VIPs. */
  blockLinks: boolean
}

/** The viewer's role in this room (`snapshot.me.role`). */
export type ChatRole = 'STREAMER' | 'MODERATOR' | 'ADMIN' | 'VIP' | 'SUBSCRIBER' | 'VIEWER' | 'GUEST'

/** Badges in BR15 order. Unknown values from the server are dropped. */
export type ChatBadge = 'STREAMER' | 'MODERATOR' | 'VIP' | 'SUB_T1' | 'SUB_T2' | 'SUB_T3' | 'VERIFIED'

export type ChatMe = {
  role: ChatRole
  badges: ChatBadge[]
  color: string | null
  canSend: boolean
  /** Error code why sending is refused (`CHAT_FOLLOWERS_ONLY`, `CHAT_BANNED`…). */
  reason: string | null
  retryAfterSec: number | null
  /** `until` of a timeout, when the server says. */
  until: string | null
  /** `requiredMin` of Followers-only, when the server says. */
  requiredMin: number | null
  /** GĐ5: the moderation tools are offered (owner, Moderator, Admin). */
  canModerate: boolean
  /** GĐ5: the viewer's own ban or running timeout in this channel. */
  restriction: { type: 'BAN' | 'TIMEOUT'; until: string | null } | null
}

/** `pinned`: the one pinned message of the room (GĐ5), null when none. */
export type ChatRoomState = { status: RoomStatus; mode: ChatMode; pinned: ChatMessage | null }

export type ChatSnapshot = { room: ChatRoomState; me: ChatMe | null }

export type Fragment =
  | { type: 'text'; text: string }
  | { type: 'emote'; text: string; emote: { id: string; code: string; imageUrl: string } }
  | { type: 'mention'; text: string; userId: string | null }

export type ChatUser = {
  id: string
  username: string
  displayName: string
  color: string | null
  badges: ChatBadge[]
}

export type ChatMessageType = 'NORMAL' | 'SYSTEM'

export type ChatMessage = {
  id: string
  streamId: string
  user: ChatUser
  body: string
  fragments: Fragment[]
  type: ChatMessageType
  createdAt: string
  deleted: boolean
  /** GĐ5: this is the room's pinned message. */
  pinned: boolean
  /** Echoed by the server for the sender's own message, when it does. */
  clientMsgId: string | null
}

export type Emote = {
  id: string
  code: string
  imageUrl: string
  animated: boolean
  scope: 'GLOBAL' | 'CHANNEL'
}

export type ChatSettings = ChatMode & { updatedAt: string | null }

export type HistoryPage = { items: ChatMessage[]; nextCursor: string | null }

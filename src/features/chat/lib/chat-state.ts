import { CHAT_LIMITS } from '@/features/chat/lib/constants'
import { effectFromMe, type BlockedReason, type ChatLock, type ErrorEffect, type InputNotice } from '@/features/chat/lib/errors'
import type { ChatMe, ChatMessage, ChatMode, ChatRoomState, ChatSnapshot, RoomStatus } from '@/features/chat/types'

/**
 * Chat room state on the client: the list (≤ 150, BR23), the buffer while scrolled up (≤ 500, BR25), own
 * messages PENDING → DELIVERED / FAILED (NXL-B §7C) and what the input may do. A pure reducer so every rule
 * is unit-tested; the hook feeds it socket events in batches.
 */

/**
 * NXL-B §7C, client side. REJECTED messages leave the list and go back to the draft; BLOCKED ones (auto-mod,
 * GĐ5) stay for their sender only, marked, without "Gửi lại".
 */
export type Delivery = 'PENDING' | 'DELIVERED' | 'FAILED' | 'BLOCKED'

export type ChatItem =
  | { kind: 'message'; key: string; message: ChatMessage; delivery: Delivery; clientMsgId: string | null; blockedReason?: BlockedReason }
  | { kind: 'notice'; key: string; notice: Notice }
  | { kind: 'divider'; key: string }

/** System lines: a mode change (rendered in the viewer's language) or server text. */
export type Notice = { type: 'mode'; mode: ChatMode; previous: ChatMode | null } | { type: 'text'; text: string }

export type IncomingEvent =
  | { type: 'message'; message: ChatMessage }
  | { type: 'ack'; clientMsgId: string; messageId: string }
  | { type: 'system'; text: string }
  | { type: 'mode_change'; mode: ChatMode }
  | { type: 'room_state'; status: RoomStatus }
  | { type: 'sampling'; active: boolean }
  | { type: 'delete'; messageId: string }
  | { type: 'user_cleared'; userId: string; reason: 'timeout' | 'ban'; until: string | null }
  | { type: 'user_restored'; userId: string }
  | { type: 'pin'; message: ChatMessage }
  | { type: 'unpin' }

export type ChatState = {
  /** History over REST: shown as a skeleton until it answers. */
  phase: 'loading' | 'ready' | 'error'
  items: ChatItem[]
  buffer: ChatItem[]
  /** AF03: the reader scrolled up; new lines wait in `buffer`. */
  paused: boolean
  /** Messages waiting in the buffer ("Có tin mới ↓"). */
  unseen: number
  room: ChatRoomState | null
  me: ChatMe | null
  /** Sampling active on this room (BR22): "Chat đang rất nhanh — hiển thị rút gọn". */
  sampling: boolean
  lock: ChatLock | null
  cooldownUntil: number | null
  notice: InputNotice | null
  /** Bumped on each @mention of the viewer (collapsed column indicator, live region). */
  mentions: number
  seq: number
}

export type ChatAction =
  | { type: 'history'; messages: ChatMessage[]; resync?: boolean }
  | { type: 'historyFailed' }
  | { type: 'snapshot'; snapshot: ChatSnapshot; now: number }
  | { type: 'batch'; events: IncomingEvent[]; myId: string | null; myUsername: string | null }
  | { type: 'send'; message: ChatMessage; clientMsgId: string; slowSec: number; now: number }
  | { type: 'ackTimeout'; clientMsgId: string }
  | { type: 'retry'; clientMsgId: string }
  | { type: 'rejected'; clientMsgId: string | null; effect: ErrorEffect }
  | { type: 'scroll'; paused: boolean }
  | { type: 'clearNotice' }
  /** A moderation call answered FORBIDDEN: the role is gone, the tools hide (design 03e cell 13). */
  | { type: 'modLost' }
  | { type: 'reset' }

export const initialChatState: ChatState = {
  phase: 'loading',
  items: [],
  buffer: [],
  paused: false,
  unseen: 0,
  room: null,
  me: null,
  sampling: false,
  lock: null,
  cooldownUntil: null,
  notice: null,
  mentions: 0,
  seq: 0,
}

/** BR19: the viewer is mentioned (a mention fragment for their id or `@username`, case-insensitive). */
export function mentionsUser(message: ChatMessage, myId: string | null, myUsername: string | null): boolean {
  if (!myId && !myUsername) return false
  const name = myUsername?.toLowerCase()

  return message.fragments.some(
    (f) => f.type === 'mention' && ((myId !== null && f.userId === myId) || (name !== undefined && f.text.replace(/^@/, '').toLowerCase() === name)),
  )
}

function messageItem(message: ChatMessage, delivery: Delivery = 'DELIVERED', clientMsgId: string | null = null): ChatItem {
  return { kind: 'message', key: `m:${clientMsgId ?? message.id}`, message, delivery, clientMsgId }
}

/** Keeps the newest `max` lines. */
function cap(items: ChatItem[], max: number): ChatItem[] {
  return items.length > max ? items.slice(items.length - max) : items
}

function hasMessage(items: readonly ChatItem[], id: string): boolean {
  return items.some((i) => i.kind === 'message' && i.message.id === id)
}

function countMessages(items: readonly ChatItem[]): number {
  return items.reduce((n, i) => (i.kind === 'message' ? n + 1 : n), 0)
}

function sameMode(a: ChatMode, b: ChatMode): boolean {
  return a.slowSec === b.slowSec && a.followersMin === b.followersMin && a.subsOnly === b.subsOnly
}

/** Applies `fn` to every message line (list and buffer) that matches. */
function mapMessages(state: ChatState, match: (m: ChatMessage) => boolean, fn: (m: ChatMessage) => ChatMessage): ChatState {
  let changed = false
  const map = (items: ChatItem[]) =>
    items.map((i) => {
      if (i.kind !== 'message' || !match(i.message)) return i
      changed = true

      return { ...i, message: fn(i.message) }
    })
  const items = map(state.items)
  const buffer = map(state.buffer)

  return changed ? { ...state, items, buffer } : state
}

/** Deleted lines keep their place and author; the text is gone for everyone (BR-F27, design 03e). */
function asDeleted(m: ChatMessage): ChatMessage {
  return { ...m, deleted: true, pinned: false, body: '', fragments: [] }
}

function withPinned(state: ChatState, pinned: ChatMessage | null): ChatState {
  if (!state.room) return state

  return { ...state, room: { ...state.room, pinned } }
}

/** A user's restriction ended (lifted, or cleared from the snapshot): their own lock goes. */
function unlockRestriction(lock: ChatLock | null): ChatLock | null {
  return lock?.kind === 'timeout' || lock?.kind === 'banned' ? null : lock
}

/** A mode that is switched off cannot keep its lock; the server says again if something else still applies. */
function unlockForMode(lock: ChatLock | null, mode: ChatMode): ChatLock | null {
  if (lock?.kind === 'followers' && mode.followersMin === null) return null
  if (lock?.kind === 'subs' && !mode.subsOnly) return null

  return lock
}

function applyEffect(state: ChatState, effect: ErrorEffect): ChatState {
  return {
    ...state,
    lock: effect.lock ?? state.lock,
    cooldownUntil: effect.cooldownUntil ?? state.cooldownUntil,
    notice: effect.notice ?? state.notice,
  }
}

/** Appends lines to the list, or to the buffer while paused. */
function appendLines(state: ChatState, lines: ChatItem[]): ChatState {
  if (lines.length === 0) return state
  if (state.paused) {
    const buffer = cap([...state.buffer, ...lines], CHAT_LIMITS.pausedBufferMax)

    return { ...state, buffer, unseen: countMessages(buffer) }
  }

  return { ...state, items: cap([...state.items, ...lines], CHAT_LIMITS.domLimit) }
}

/** Replaces a line in the list or the buffer; false when nothing matched. */
function replaceWhere(state: ChatState, match: (i: ChatItem) => boolean, next: (i: ChatItem) => ChatItem): ChatState | null {
  const at = state.items.findIndex(match)
  if (at >= 0) {
    const items = [...state.items]
    items[at] = next(items[at])

    return { ...state, items }
  }
  const inBuffer = state.buffer.findIndex(match)
  if (inBuffer >= 0) {
    const buffer = [...state.buffer]
    buffer[inBuffer] = next(buffer[inBuffer])

    return { ...state, buffer }
  }

  return null
}

function isOwnPending(i: ChatItem, message: ChatMessage, myId: string | null): boolean {
  if (i.kind !== 'message' || i.delivery === 'DELIVERED' || !i.clientMsgId) return false
  if (message.clientMsgId) return i.clientMsgId === message.clientMsgId

  return myId !== null && message.user.id === myId && i.message.body === message.body
}

function onMessage(state: ChatState, message: ChatMessage, myId: string | null, myUsername: string | null): ChatState {
  // Same id already shown (ack came first, resume replay, history overlap): update in place.
  const byId = replaceWhere(
    state,
    (i) => i.kind === 'message' && i.message.id === message.id,
    (i) => (i.kind === 'message' ? { ...i, message, delivery: 'DELIVERED' } : i),
  )
  if (byId) return byId

  // Our own message coming back before its ack: it replaces the optimistic line.
  const own = replaceWhere(
    state,
    (i) => isOwnPending(i, message, myId),
    (i) => (i.kind === 'message' ? { ...i, message, delivery: 'DELIVERED' } : i),
  )
  if (own) return own

  const mentioned = message.user.id !== myId && mentionsUser(message, myId, myUsername)
  const next = appendLines(state, [messageItem(message)])

  return mentioned ? { ...next, mentions: next.mentions + 1 } : next
}

function onAck(state: ChatState, clientMsgId: string, messageId: string): ChatState {
  return (
    replaceWhere(
      state,
      (i) => i.kind === 'message' && i.clientMsgId === clientMsgId,
      // A late ack after the 5 s timeout still means the server stored it: DELIVERED, not a duplicate.
      (i) => (i.kind === 'message' ? { ...i, delivery: 'DELIVERED', message: { ...i.message, id: messageId } } : i),
    ) ?? state
  )
}

function noticeItem(state: ChatState, notice: Notice): ChatItem {
  return { kind: 'notice', key: `n:${state.seq}`, notice }
}

function applyEvent(state: ChatState, ev: IncomingEvent, myId: string | null, myUsername: string | null): ChatState {
  switch (ev.type) {
    case 'message':
      return onMessage(state, ev.message, myId, myUsername)
    case 'ack':
      return onAck(state, ev.clientMsgId, ev.messageId)
    case 'system': {
      const s = { ...state, seq: state.seq + 1 }

      return appendLines(s, [noticeItem(s, { type: 'text', text: ev.text })])
    }
    case 'mode_change': {
      const previous = state.room?.mode ?? null
      // Only "block links" changed: no line in the chat, the moderators see it in their settings.
      if (previous && sameMode(previous, ev.mode)) return state.room && previous.blockLinks !== ev.mode.blockLinks ? { ...state, room: { ...state.room, mode: ev.mode } } : state
      const room: ChatRoomState = { status: state.room?.status ?? 'OPEN', mode: ev.mode, pinned: state.room?.pinned ?? null }
      const s: ChatState = {
        ...state,
        room,
        seq: state.seq + 1,
        lock: unlockForMode(state.lock, ev.mode),
        cooldownUntil: ev.mode.slowSec === 0 && state.notice?.kind !== 'rateLimited' ? null : state.cooldownUntil,
      }

      return appendLines(s, [noticeItem(s, { type: 'mode', mode: ev.mode, previous })])
    }
    case 'room_state': {
      const room: ChatRoomState = {
        status: ev.status,
        mode: state.room?.mode ?? { slowSec: 0, followersMin: null, subsOnly: false, blockLinks: false },
        pinned: state.room?.pinned ?? null,
      }
      // Back to OPEN ends a kill switch (E18: recovers by itself).
      const lock = ev.status === 'OPEN' && (state.lock?.kind === 'disabled' || state.lock?.kind === 'readOnly' || state.lock?.kind === 'closed') ? null : state.lock

      return { ...state, room, lock }
    }
    case 'sampling':
      return { ...state, sampling: ev.active }
    case 'delete': {
      const s = mapMessages(state, (m) => m.id === ev.messageId, asDeleted)

      return s.room?.pinned?.id === ev.messageId ? withPinned(s, null) : s
    }
    case 'user_cleared': {
      let s = mapMessages(state, (m) => m.user.id === ev.userId && m.type === 'NORMAL' && !m.deleted, asDeleted)
      if (s.room?.pinned?.user.id === ev.userId) s = withPinned(s, null)
      if (ev.userId !== myId) return s
      const lock: ChatLock = ev.reason === 'ban' ? { kind: 'banned' } : { kind: 'timeout', until: ev.until }

      return { ...s, lock, cooldownUntil: null }
    }
    case 'user_restored':
      return ev.userId === myId ? { ...state, lock: unlockRestriction(state.lock) } : state
    case 'pin': {
      const s = mapMessages(state, (m) => m.pinned || m.id === ev.message.id, (m) => ({ ...m, pinned: m.id === ev.message.id }))

      return withPinned(s, { ...ev.message, pinned: true })
    }
    case 'unpin': {
      const s = mapMessages(state, (m) => m.pinned, (m) => ({ ...m, pinned: false }))

      return withPinned(s, null)
    }
  }
}

function mergeHistory(state: ChatState, messages: ChatMessage[], resync: boolean): ChatState {
  if (!resync) {
    // First load: history first, then whatever arrived live meanwhile (minus overlaps).
    const live = state.items.filter((i) => i.kind !== 'message' || !messages.some((m) => m.id === i.message.id))
    const items = cap([...messages.map((m) => messageItem(m)), ...live], CHAT_LIMITS.domLimit)

    return { ...state, phase: 'ready', items }
  }
  // AF09 step 4 / BR24: a divider, then the recent messages we do not have yet.
  const known = [...state.items, ...state.buffer]
  const fresh = messages.filter((m) => !hasMessage(known, m.id))
  const s = { ...state, phase: 'ready' as const, seq: state.seq + 1 }

  return appendLines(s, [{ kind: 'divider', key: `d:${s.seq}` }, ...fresh.map((m) => messageItem(m))])
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'history':
      return mergeHistory(state, action.messages, action.resync ?? false)
    case 'historyFailed':
      return state.phase === 'loading' ? { ...state, phase: 'error' } : state
    case 'snapshot': {
      const { room, me } = action.snapshot
      const effect = effectFromMe(me, action.now)
      // The snapshot is the server's current word: its lock replaces ours (or clears it).
      const lock = effect.lock ?? (state.lock?.kind === 'timeout' && me && !me.canSend ? state.lock : null)

      return { ...state, room, me, lock, cooldownUntil: effect.cooldownUntil ?? state.cooldownUntil }
    }
    case 'batch': {
      let s = state
      for (const ev of action.events) s = applyEvent(s, ev, action.myId, action.myUsername)

      return s
    }
    case 'send': {
      // Sending means reading the bottom again: flush the buffer, then the optimistic PENDING line.
      const resumed = chatReducer(state, { type: 'scroll', paused: false })
      const slowUntil = action.slowSec > 0 ? action.now + action.slowSec * 1000 : null

      return {
        ...appendLines(resumed, [messageItem(action.message, 'PENDING', action.clientMsgId)]),
        notice: null,
        cooldownUntil: slowUntil ?? resumed.cooldownUntil,
      }
    }
    case 'ackTimeout':
      return (
        replaceWhere(
          state,
          (i) => i.kind === 'message' && i.clientMsgId === action.clientMsgId && i.delivery === 'PENDING',
          (i) => (i.kind === 'message' ? { ...i, delivery: 'FAILED' } : i),
        ) ?? state
      )
    case 'retry':
      return (
        replaceWhere(
          state,
          (i) => i.kind === 'message' && i.clientMsgId === action.clientMsgId && i.delivery === 'FAILED',
          (i) => (i.kind === 'message' ? { ...i, delivery: 'PENDING' } : i),
        ) ?? state
      )
    case 'rejected': {
      const id = action.clientMsgId
      const reason = action.effect.blocked
      if (id && reason) {
        // Auto-mod refusal: the line stays, marked, for its sender only (design 03f cells 4–5).
        const marked =
          replaceWhere(
            state,
            (i) => i.kind === 'message' && i.clientMsgId === id && i.delivery !== 'DELIVERED',
            (i) => (i.kind === 'message' ? { ...i, delivery: 'BLOCKED', blockedReason: reason } : i),
          ) ?? state

        return applyEffect({ ...marked, cooldownUntil: action.effect.cooldownUntil ?? null }, action.effect)
      }
      const without = id
        ? { ...state, items: state.items.filter((i) => !(i.kind === 'message' && i.clientMsgId === id && i.delivery !== 'DELIVERED')) }
        : state
      // A refused message does not hold the slow-mode countdown we started for it.
      const cleared = id && !action.effect.cooldownUntil ? { ...without, cooldownUntil: null } : without

      return applyEffect(cleared, action.effect)
    }
    case 'scroll': {
      if (action.paused === state.paused) return state
      if (action.paused) return { ...state, paused: true }
      const items = cap([...state.items, ...state.buffer], CHAT_LIMITS.domLimit)

      return { ...state, paused: false, items, buffer: [], unseen: 0 }
    }
    case 'clearNotice':
      return state.notice ? { ...state, notice: null } : state
    case 'modLost':
      return state.me ? { ...state, me: { ...state.me, canModerate: false, role: state.me.role === 'MODERATOR' ? 'VIEWER' : state.me.role } } : state
    case 'reset':
      return initialChatState
  }
}

/** Distinct people who chatted recently, newest first (AF02 suggestions). */
export function recentChatters(items: readonly ChatItem[], myId: string | null, limit: number = CHAT_LIMITS.recentChatters) {
  const out: { id: string; username: string; displayName: string }[] = []
  const seen = new Set<string>()
  for (let i = items.length - 1; i >= 0 && out.length < limit; i--) {
    const it = items[i]
    if (it.kind !== 'message' || it.message.type !== 'NORMAL') continue
    const u = it.message.user
    if (u.id === myId || seen.has(u.id) || !u.username) continue
    seen.add(u.id)
    out.push({ id: u.id, username: u.username, displayName: u.displayName })
  }

  return out
}

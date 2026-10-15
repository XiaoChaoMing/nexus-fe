import { describe, expect, it } from 'vitest'
import { chatReducer, initialChatState, mentionsUser, recentChatters, type ChatAction, type ChatState, type IncomingEvent } from './chat-state'
import { CHAT_LIMITS } from './constants'
import { errorEffect } from './errors'
import type { ChatMe, ChatMessage } from '../types'

let n = 0
function msg(over: Partial<ChatMessage> & { userId?: string; username?: string } = {}): ChatMessage {
  n += 1
  const { userId = `u${n}`, username = `user${n}`, ...rest } = over

  return {
    id: `m${n}`,
    streamId: 's1',
    user: { id: userId, username, displayName: username, color: null, badges: [] },
    body: `hello ${n}`,
    fragments: [{ type: 'text', text: `hello ${n}` }],
    type: 'NORMAL',
    createdAt: '2026-10-14T10:00:00Z',
    deleted: false,
    pinned: false,
    clientMsgId: null,
    ...rest,
  }
}

function run(state: ChatState, ...actions: ChatAction[]): ChatState {
  return actions.reduce(chatReducer, state)
}

function batch(...events: IncomingEvent[]): ChatAction {
  return { type: 'batch', events, myId: 'me', myUsername: 'minh' }
}

function ids(state: ChatState): string[] {
  return state.items.map((i) => (i.kind === 'message' ? i.message.id : i.kind))
}

const ready = run(initialChatState, { type: 'history', messages: [] })

describe('chatReducer — list', () => {
  it('shows history, then live messages without duplicates', () => {
    const a = msg()
    const b = msg()
    const live = msg()
    // A live message arrives before the history answer, and the history also contains it.
    const s = run(initialChatState, batch({ type: 'message', message: live }), { type: 'history', messages: [a, b, live] })
    expect(s.phase).toBe('ready')
    expect(ids(s)).toEqual([a.id, b.id, live.id])
  })

  it('keeps at most 150 lines', () => {
    const events = Array.from({ length: 200 }, () => ({ type: 'message', message: msg() }) as const)
    const s = run(ready, batch(...events))
    expect(s.items).toHaveLength(CHAT_LIMITS.domLimit)
    expect(s.items.at(-1)).toMatchObject({ message: { id: events.at(-1)?.message.id } })
  })

  it('a message seen twice (resume replay) is shown once', () => {
    const a = msg()
    const s = run(ready, batch({ type: 'message', message: a }), batch({ type: 'message', message: a }))
    expect(ids(s)).toEqual([a.id])
  })

  it('buffers while scrolled up (≤ 500) and flushes on resume', () => {
    const before = msg()
    let s = run(ready, batch({ type: 'message', message: before }), { type: 'scroll', paused: true })
    s = run(s, batch(...Array.from({ length: 520 }, () => ({ type: 'message', message: msg() }) as const)))
    expect(ids(s)).toEqual([before.id])
    expect(s.buffer).toHaveLength(CHAT_LIMITS.pausedBufferMax)
    expect(s.unseen).toBe(500)
    s = run(s, { type: 'scroll', paused: false })
    expect(s.buffer).toHaveLength(0)
    expect(s.unseen).toBe(0)
    expect(s.items).toHaveLength(CHAT_LIMITS.domLimit)
  })

  it('inserts the "missed" divider and only new messages after a resync', () => {
    const a = msg()
    const b = msg()
    const c = msg()
    let s = run(ready, batch({ type: 'message', message: a }))
    s = run(s, { type: 'history', messages: [a, b, c], resync: true })
    expect(ids(s)).toEqual([a.id, 'divider', b.id, c.id])
  })

  it('counts mentions of the viewer', () => {
    const m = msg({ fragments: [{ type: 'text', text: 'hi ' }, { type: 'mention', text: '@Minh', userId: null }] })
    const s = run(ready, batch({ type: 'message', message: m }))
    expect(s.mentions).toBe(1)
  })
})

describe('chatReducer — sending (NXL-B §7C)', () => {
  const mine = () => msg({ userId: 'me', username: 'minh', body: 'xin chào', fragments: [{ type: 'text', text: 'xin chào' }] })

  it('PENDING → DELIVERED on ack, then the broadcast copy replaces it in place', () => {
    const local = mine()
    let s = run(ready, { type: 'send', message: local, clientMsgId: 'c1', slowSec: 0, now: 0 })
    expect(s.items[0]).toMatchObject({ delivery: 'PENDING', clientMsgId: 'c1' })
    s = run(s, batch({ type: 'ack', clientMsgId: 'c1', messageId: 'srv1' }))
    expect(s.items[0]).toMatchObject({ delivery: 'DELIVERED', message: { id: 'srv1' } })
    s = run(s, batch({ type: 'message', message: { ...local, id: 'srv1' } }))
    expect(s.items).toHaveLength(1)
  })

  it('the broadcast copy arriving before the ack replaces the pending line', () => {
    const local = mine()
    let s = run(ready, { type: 'send', message: local, clientMsgId: 'c1', slowSec: 0, now: 0 })
    s = run(s, batch({ type: 'message', message: { ...local, id: 'srv1' } }), batch({ type: 'ack', clientMsgId: 'c1', messageId: 'srv1' }))
    expect(s.items).toHaveLength(1)
    expect(s.items[0]).toMatchObject({ delivery: 'DELIVERED', message: { id: 'srv1' } })
  })

  it('PENDING → FAILED after the ack timeout, FAILED → PENDING on retry', () => {
    let s = run(ready, { type: 'send', message: mine(), clientMsgId: 'c1', slowSec: 0, now: 0 }, { type: 'ackTimeout', clientMsgId: 'c1' })
    expect(s.items[0]).toMatchObject({ delivery: 'FAILED' })
    s = run(s, { type: 'retry', clientMsgId: 'c1' })
    expect(s.items[0]).toMatchObject({ delivery: 'PENDING' })
  })

  it('ack timeout does not touch a delivered message', () => {
    const s = run(ready, { type: 'send', message: mine(), clientMsgId: 'c1', slowSec: 0, now: 0 }, batch({ type: 'ack', clientMsgId: 'c1', messageId: 'x' }), { type: 'ackTimeout', clientMsgId: 'c1' })
    expect(s.items[0]).toMatchObject({ delivery: 'DELIVERED' })
  })

  it('a rejected message leaves the list and applies the effect', () => {
    const s = run(
      ready,
      { type: 'send', message: mine(), clientMsgId: 'c1', slowSec: 10, now: 1000 },
      { type: 'rejected', clientMsgId: 'c1', effect: errorEffect('CHAT_SLOW_MODE', { retryAfterSec: 8 }, 2000) },
    )
    expect(s.items).toHaveLength(0)
    expect(s.cooldownUntil).toBe(10_000)
    expect(s.notice).toEqual({ kind: 'slow', untilMs: 10_000 })
  })

  it('a duplicate refusal clears the slow countdown started for that message', () => {
    const s = run(ready, { type: 'send', message: mine(), clientMsgId: 'c1', slowSec: 10, now: 0 }, { type: 'rejected', clientMsgId: 'c1', effect: errorEffect('CHAT_DUPLICATE') })
    expect(s.cooldownUntil).toBeNull()
    expect(s.notice).toEqual({ kind: 'duplicate' })
  })

  it('sending starts the slow-mode countdown and resumes auto-scroll', () => {
    const s = run(ready, { type: 'scroll', paused: true }, batch({ type: 'message', message: msg() }), { type: 'send', message: mine(), clientMsgId: 'c1', slowSec: 5, now: 100 })
    expect(s.paused).toBe(false)
    expect(s.items).toHaveLength(2)
    expect(s.cooldownUntil).toBe(5100)
  })
})

describe('chatReducer — room', () => {
  const snapshot = (over: Partial<ChatMe> = {}): ChatAction => ({
    type: 'snapshot',
    now: 0,
    snapshot: {
      room: { status: 'OPEN', mode: { slowSec: 0, followersMin: 10, subsOnly: false, blockLinks: false }, pinned: null },
      me: { role: 'VIEWER', badges: [], color: null, canSend: false, reason: 'CHAT_FOLLOWERS_ONLY', retryAfterSec: null, until: null, requiredMin: 10, canModerate: false, restriction: null, ...over },
    },
  })

  it('takes the lock from the snapshot and drops it when the mode is switched off', () => {
    let s = run(ready, snapshot())
    expect(s.lock).toEqual({ kind: 'followers', requiredMin: 10 })
    s = run(s, batch({ type: 'mode_change', mode: { slowSec: 0, followersMin: null, subsOnly: false, blockLinks: false } }))
    expect(s.lock).toBeNull()
    expect(s.items.at(-1)).toMatchObject({ kind: 'notice', notice: { type: 'mode' } })
  })

  it('a snapshot that can send clears an earlier lock', () => {
    const s = run(ready, snapshot(), snapshot({ canSend: true, reason: null }))
    expect(s.lock).toBeNull()
  })

  it('ignores a mode_change that changes nothing', () => {
    const s = run(ready, snapshot(), batch({ type: 'mode_change', mode: { slowSec: 0, followersMin: 10, subsOnly: false, blockLinks: false } }))
    expect(s.items).toHaveLength(0)
  })

  it('room_state READ_ONLY, sampling and server system lines', () => {
    const s = run(ready, batch({ type: 'room_state', status: 'READ_ONLY' }, { type: 'sampling', active: true }, { type: 'system', text: 'An đã đăng ký' }))
    expect(s.room?.status).toBe('READ_ONLY')
    expect(s.sampling).toBe(true)
    expect(s.items[0]).toMatchObject({ kind: 'notice', notice: { type: 'text', text: 'An đã đăng ký' } })
  })

  it('room_state OPEN ends a kill switch', () => {
    const s = run(ready, { type: 'rejected', clientMsgId: null, effect: errorEffect('CHAT_DISABLED') }, batch({ type: 'room_state', status: 'OPEN' }))
    expect(s.lock).toBeNull()
  })
})

describe('helpers', () => {
  it('mentionsUser matches the id or the username, case-insensitive', () => {
    const m = msg({ fragments: [{ type: 'mention', text: '@MINH', userId: null }] })
    expect(mentionsUser(m, null, 'minh')).toBe(true)
    expect(mentionsUser(msg({ fragments: [{ type: 'mention', text: '@x', userId: 'me' }] }), 'me', null)).toBe(true)
    expect(mentionsUser(msg({ fragments: [{ type: 'text', text: '@minh' }] }), 'me', 'minh')).toBe(false)
  })

  it('recentChatters lists distinct people, newest first, without me', () => {
    const s = run(ready, batch(...[msg({ userId: 'a', username: 'an' }), msg({ userId: 'b', username: 'binh' }), msg({ userId: 'a', username: 'an' }), msg({ userId: 'me', username: 'minh' })].map((message) => ({ type: 'message', message }) as const)))
    expect(recentChatters(s.items, 'me').map((c) => c.username)).toEqual(['an', 'binh'])
  })
})

describe('chatReducer — moderation (GĐ5)', () => {
  const room = (pinned: ChatMessage | null = null): ChatAction => ({
    type: 'snapshot',
    now: 0,
    snapshot: {
      room: { status: 'OPEN', mode: { slowSec: 0, followersMin: null, subsOnly: false, blockLinks: false }, pinned },
      me: { role: 'VIEWER', badges: [], color: null, canSend: true, reason: null, retryAfterSec: null, until: null, requiredMin: null, canModerate: false, restriction: null },
    },
  })
  const line = (s: ChatState, id: string) => s.items.find((i) => i.kind === 'message' && i.message.id === id)

  it('delete keeps the line and its author, empties the text and drops the pin', () => {
    const m = msg({ userId: 'x' })
    let s = run(ready, room(), batch({ type: 'message', message: m }, { type: 'pin', message: m }))
    expect(s.room?.pinned?.id).toBe(m.id)
    s = run(s, batch({ type: 'delete', messageId: m.id }))
    expect(line(s, m.id)).toMatchObject({ message: { deleted: true, body: '', fragments: [], user: { id: 'x' } } })
    expect(s.room?.pinned).toBeNull()
  })

  it('user_cleared deletes every line of that user; for me it locks the input', () => {
    const a = msg({ userId: 'x' })
    const b = msg({ userId: 'x' })
    const c = msg({ userId: 'y' })
    let s = run(ready, room(), batch(...[a, b, c].map((message) => ({ type: 'message', message }) as const)))
    s = run(s, batch({ type: 'user_cleared', userId: 'x', reason: 'timeout', until: '2026-10-15T10:10:00Z' }))
    expect([a, b, c].map((m) => line(s, m.id)?.kind === 'message' && (line(s, m.id) as { message: ChatMessage }).message.deleted)).toEqual([true, true, false])
    expect(s.lock).toBeNull()
    s = run(s, batch({ type: 'user_cleared', userId: 'me', reason: 'ban', until: null }))
    expect(s.lock).toEqual({ kind: 'banned' })
    s = run(s, batch({ type: 'user_restored', userId: 'someone' }))
    expect(s.lock).toEqual({ kind: 'banned' })
    s = run(s, batch({ type: 'user_restored', userId: 'me' }))
    expect(s.lock).toBeNull()
  })

  it('a timeout of me carries its end; the pinned line of a cleared user goes', () => {
    const p = msg({ userId: 'x' })
    let s = run(ready, room(p))
    s = run(s, batch({ type: 'user_cleared', userId: 'me', reason: 'timeout', until: '2026-10-15T10:10:00Z' }))
    expect(s.lock).toEqual({ kind: 'timeout', until: '2026-10-15T10:10:00Z' })
    s = run(s, batch({ type: 'user_cleared', userId: 'x', reason: 'ban', until: null }))
    expect(s.room?.pinned).toBeNull()
  })

  it('pin replaces the previous pin, unpin clears it', () => {
    const a = msg()
    const b = msg()
    let s = run(ready, room(), batch({ type: 'message', message: a }, { type: 'message', message: b }, { type: 'pin', message: a }, { type: 'pin', message: b }))
    expect(s.room?.pinned?.id).toBe(b.id)
    expect((line(s, a.id) as { message: ChatMessage }).message.pinned).toBe(false)
    expect((line(s, b.id) as { message: ChatMessage }).message.pinned).toBe(true)
    s = run(s, batch({ type: 'unpin' }))
    expect(s.room?.pinned).toBeNull()
    expect((line(s, b.id) as { message: ChatMessage }).message.pinned).toBe(false)
  })

  it('a blocked send stays for its sender, marked, without being returned to the input', () => {
    const mine = msg({ userId: 'me', clientMsgId: 'c1' })
    let s = run(ready, room(), { type: 'send', message: mine, clientMsgId: 'c1', slowSec: 0, now: 0 })
    s = run(s, { type: 'rejected', clientMsgId: 'c1', effect: errorEffect('CHAT_CONTENT_BLOCKED', { reason: 'LINK' }) })
    expect(s.items.at(-1)).toMatchObject({ delivery: 'BLOCKED', blockedReason: 'LINK' })
    expect(s.notice).toEqual({ kind: 'contentBlocked', reason: 'LINK' })
  })

  it('the snapshot restriction locks; modLost hides the tools', () => {
    let s = run(ready, {
      type: 'snapshot',
      now: Date.parse('2026-10-15T10:00:00Z'),
      snapshot: {
        room: { status: 'OPEN', mode: { slowSec: 0, followersMin: null, subsOnly: false, blockLinks: true }, pinned: null },
        me: { role: 'MODERATOR', badges: [], color: null, canSend: true, reason: null, retryAfterSec: null, until: null, requiredMin: null, canModerate: true, restriction: { type: 'TIMEOUT', until: '2026-10-15T10:05:00Z' } },
      },
    })
    expect(s.lock).toEqual({ kind: 'timeout', until: '2026-10-15T10:05:00Z' })
    s = run(s, { type: 'modLost' })
    expect(s.me).toMatchObject({ canModerate: false, role: 'VIEWER' })
  })

  it('a mode change of blockLinks only updates the mode silently', () => {
    let s = run(ready, room())
    s = run(s, batch({ type: 'mode_change', mode: { slowSec: 0, followersMin: null, subsOnly: false, blockLinks: true } }))
    expect(s.room?.mode.blockLinks).toBe(true)
    expect(s.items).toHaveLength(0)
  })
})

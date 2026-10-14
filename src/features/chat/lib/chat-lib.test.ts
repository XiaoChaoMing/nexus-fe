import { describe, expect, it } from 'vitest'
import { contrastRatio, USERNAME_PALETTE, usernameColor, visibleBadges } from './appearance'
import { canAddLine, charCount, checkDraft, completeMention, insertToken, localFragments, mentionAt, showCounter, suggestMentions } from './compose'
import { composerView, effectFromMe, errorEffect, type ComposerInput } from './errors'
import type { ChatMe } from '../types'
import { parseChatEvent, parseChatSnapshot, parseEmotes, parseHistory, parseMessage, safeImageUrl } from './parse'

describe('username colours (BR16)', () => {
  it('has 12 colours, each ≥ 4.5:1 on the chat surface and on cards', () => {
    expect(USERNAME_PALETTE).toHaveLength(12)
    for (const c of USERNAME_PALETTE) {
      expect(contrastRatio(c, '#18181B'), c).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(c, '#202024'), c).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('is deterministic per user id and spreads over the palette', () => {
    expect(usernameColor('0b8f1c2e-1111-4000-8000-000000000001')).toBe(usernameColor('0b8f1c2e-1111-4000-8000-000000000001'))
    const used = new Set(Array.from({ length: 200 }, (_, i) => usernameColor(`user-${i}`)))
    expect(used.size).toBe(12)
  })

  it('picks like chat-svc (FNV-1a 32 of the id, mod 12)', () => {
    // fnv32a("a") = 0xe40c292c → 3826002220 % 12 = 4
    expect(usernameColor('a')).toBe(USERNAME_PALETTE[3826002220 % 12])
  })

  it('uses the server colour only when it is in the palette', () => {
    expect(usernameColor('x', '#ffa94d')).toBe('#FFA94D')
    expect(usernameColor('x', '#000000')).toBe(usernameColor('x'))
  })
})

describe('visibleBadges (BR15)', () => {
  it('orders Streamer > Moderator > VIP > Subscriber > Verified and keeps 3', () => {
    expect(visibleBadges(['VERIFIED', 'SUB_T1', 'VIP', 'MODERATOR', 'STREAMER'])).toEqual(['STREAMER', 'MODERATOR', 'VIP'])
    expect(visibleBadges(['VERIFIED', 'SUB_T1'])).toEqual(['SUB_T1', 'VERIFIED'])
  })

  it('shows one subscriber badge, the highest tier', () => {
    expect(visibleBadges(['SUB_T1', 'SUB_T3', 'SUB_T2'])).toEqual(['SUB_T3'])
  })
})

describe('draft rules (BR03, E04, E05)', () => {
  it('refuses empty, too long and too many lines', () => {
    expect(checkDraft('   ')).toEqual({ ok: false, reason: 'empty' })
    expect(checkDraft('a'.repeat(501))).toEqual({ ok: false, reason: 'tooLong' })
    expect(checkDraft('a\nb\nc\nd')).toEqual({ ok: false, reason: 'tooManyLines' })
    expect(checkDraft('  xin chào  ')).toEqual({ ok: true, body: 'xin chào' })
    expect(checkDraft('😀'.repeat(500))).toMatchObject({ ok: true })
  })

  it('counts emoji as one character and shows the counter from 400', () => {
    expect(charCount('😀a')).toBe(2)
    expect(showCounter('a'.repeat(399))).toBe(false)
    expect(showCounter('a'.repeat(400))).toBe(true)
  })

  it('allows a new line only below 3 lines', () => {
    expect(canAddLine('a\nb')).toBe(true)
    expect(canAddLine('a\nb\nc')).toBe(false)
  })
})

describe('mentions and emotes in the input', () => {
  it('finds the @name being typed', () => {
    expect(mentionAt('hi @mi', 6)).toEqual({ start: 3, end: 6, query: 'mi' })
    expect(mentionAt('@', 1)).toEqual({ start: 0, end: 1, query: '' })
    expect(mentionAt('mail@host', 9)).toBeNull()
    expect(mentionAt('hi @mi there', 12)).toBeNull()
  })

  it('suggests prefix matches before substring matches, at most 5', () => {
    const people = ['minh', 'an', 'tuan_minh', 'Mai', 'mike', 'mo', 'mu', 'my'].map((u, i) => ({ id: String(i), username: u, displayName: u }))
    expect(suggestMentions(people, 'MI').map((p) => p.username)).toEqual(['minh', 'mike', 'tuan_minh'])
    expect(suggestMentions(people, 'm')).toHaveLength(5)
  })

  it('completes a mention and inserts emote codes with spaces', () => {
    const m = mentionAt('hi @mi', 6)
    expect(completeMention('hi @mi', m!, 'minh')).toEqual({ text: 'hi @minh ', caret: 9 })
    expect(insertToken('gg', 2, 'Kappa')).toEqual({ text: 'gg Kappa ', caret: 9 })
    expect(insertToken('', 0, 'Kappa')).toEqual({ text: 'Kappa ', caret: 6 })
    expect(insertToken('a b', 1, 'X')).toEqual({ text: 'a X b', caret: 4 })
  })
})

describe('error mapping (NXL-B §13)', () => {
  it.each([
    ['CHAT_FOLLOWERS_ONLY', { requiredMin: 10 }, { lock: { kind: 'followers', requiredMin: 10 } }],
    ['CHAT_SUBS_ONLY', {}, { lock: { kind: 'subs' } }],
    ['CHAT_TIMED_OUT', { until: '2026-10-14T14:30:00Z' }, { lock: { kind: 'timeout', until: '2026-10-14T14:30:00Z' } }],
    ['CHAT_BANNED', {}, { lock: { kind: 'banned' } }],
    ['CHAT_READ_ONLY', {}, { lock: { kind: 'readOnly' } }],
    ['CHAT_CLOSED', {}, { lock: { kind: 'closed' } }],
    ['CHAT_DISABLED', {}, { lock: { kind: 'disabled' } }],
    ['EMAIL_NOT_VERIFIED', {}, { lock: { kind: 'emailUnverified' } }],
    ['CHAT_DUPLICATE', {}, { notice: { kind: 'duplicate' } }],
    ['VALIDATION_FAILED', { body: 'LENGTH' }, { notice: { kind: 'invalid' } }],
    ['UNAUTHORIZED', {}, { login: true }],
    ['INTERNAL_ERROR', {}, { notice: { kind: 'failed' } }],
  ])('%s', (code, details, effect) => {
    expect(errorEffect(code, details, 0)).toEqual(effect)
  })

  it('slow mode and rate limit start a countdown from retryAfterSec', () => {
    expect(errorEffect('CHAT_SLOW_MODE', { retryAfterSec: 8 }, 1000)).toEqual({ cooldownUntil: 9000, notice: { kind: 'slow', untilMs: 9000 } })
    expect(errorEffect('RATE_LIMITED', { retryAfterSec: '5' }, 0)).toMatchObject({ cooldownUntil: 5000 })
    expect(errorEffect('CHAT_FOLLOWERS_ONLY', { requiredMin: '60', followedMin: '30' }, 0)).toEqual({ lock: { kind: 'followers', requiredMin: 60 } })
  })

  it('a snapshot refusal locks without a notice or a modal', () => {
    const me: ChatMe = { role: 'GUEST', badges: [], color: null, canSend: false, reason: 'UNAUTHORIZED', retryAfterSec: null, until: null, requiredMin: null }
    expect(effectFromMe(me)).toEqual({})
    expect(effectFromMe({ ...me, role: 'VIEWER', reason: 'CHAT_SLOW_MODE', retryAfterSec: 4 }, 0)).toEqual({ cooldownUntil: 4000 })
  })
})

describe('composerView (NXL-B §9C)', () => {
  const base: ComposerInput = { signedIn: true, connection: 'open', roomStatus: 'OPEN', streamEnded: false, lock: null, cooldownUntil: null, now: 0 }

  it('ready, with a slow-mode countdown', () => {
    expect(composerView(base)).toEqual({ kind: 'ready', cooldownSec: 0 })
    expect(composerView({ ...base, cooldownUntil: 7_400 })).toEqual({ kind: 'ready', cooldownSec: 8 })
  })

  it('read-only wins over everything, even for guests', () => {
    expect(composerView({ ...base, signedIn: false, streamEnded: true })).toEqual({ kind: 'locked', lock: { kind: 'readOnly' } })
  })

  it('guest, offline, locked', () => {
    expect(composerView({ ...base, signedIn: false })).toEqual({ kind: 'guest' })
    expect(composerView({ ...base, connection: 'reconnecting' })).toEqual({ kind: 'offline', reason: 'reconnecting' })
    expect(composerView({ ...base, lock: { kind: 'banned' } })).toEqual({ kind: 'locked', lock: { kind: 'banned' } })
  })

  it('a timeout that has run out no longer locks', () => {
    const lock = { kind: 'timeout', until: '1970-01-01T00:00:10Z' } as const
    expect(composerView({ ...base, lock, now: 5_000 }).kind).toBe('locked')
    expect(composerView({ ...base, lock, now: 10_000 }).kind).toBe('ready')
  })
})

describe('parsing untrusted payloads', () => {
  it('parses a message with fragments and drops unsafe emote URLs', () => {
    const m = parseMessage({
      id: 'm1',
      streamId: 's1',
      user: { id: 'u1', username: 'an', displayName: 'An', color: '#fb923c', badges: ['moderator', 'nope', 'SUB_T2'] },
      body: 'hi Kappa @minh',
      fragments: [
        { type: 'text', text: 'hi ' },
        { type: 'emote', text: 'Kappa', emote: { id: 'e1', code: 'Kappa', imageUrl: '/emotes/kappa.svg' } },
        { type: 'emote', text: 'Evil', emote: { id: 'e2', code: 'Evil', imageUrl: 'javascript:alert(1)' } },
        { type: 'mention', text: '@minh', userId: 'u2' },
        { type: 'html', text: '<b>x</b>' },
      ],
      type: 'NORMAL',
      createdAt: '2026-10-14T10:00:00Z',
    })
    expect(m?.user.badges).toEqual(['MODERATOR', 'SUB_T2'])
    expect(m?.fragments.map((f) => f.type)).toEqual(['text', 'emote', 'text', 'mention', 'text'])
    expect(m?.fragments[2]).toEqual({ type: 'text', text: 'Evil' })
    // Unknown fragment types become plain text, never markup.
    expect(m?.fragments[4]).toEqual({ type: 'text', text: '<b>x</b>' })
  })

  it('falls back to the body when there are no fragments', () => {
    expect(parseMessage({ id: 'm', user: { id: 'u' }, body: 'x' })?.fragments).toEqual([{ type: 'text', text: 'x' }])
    expect(parseMessage({ user: { id: 'u' } })).toBeNull()
  })

  it('history is newest first on the wire, oldest first in the app', () => {
    const items = [{ id: 'b', user: { id: 'u' }, body: '2' }, { id: 'a', user: { id: 'u' }, body: '1' }]
    expect(parseHistory({ items, nextCursor: null }).map((m) => m.id)).toEqual(['a', 'b'])
  })

  it('parses the chat snapshot with defaults', () => {
    expect(parseChatSnapshot({ room: { status: 'read_only', mode: { slowSec: 10, followersMin: null, subsOnly: true } }, me: { role: 'broadcaster', canSend: true } })).toMatchObject({
      room: { status: 'READ_ONLY', mode: { slowSec: 10, followersMin: null, subsOnly: true } },
      me: { role: 'STREAMER', canSend: true },
    })
    // chat-svc: no room yet, and a guest.
    expect(parseChatSnapshot({ room: { status: 'NOT_OPEN', mode: { slowSec: 0, followersMin: null, subsOnly: false } }, me: { role: 'GUEST', canSend: false, reason: 'UNAUTHORIZED' } })).toMatchObject({
      room: { status: 'NOT_OPEN' },
      me: { role: 'GUEST', reason: 'UNAUTHORIZED' },
    })
    expect(parseChatSnapshot({ room: {}, me: { canSend: false, reason: 'CHAT_SLOW_MODE', details: { retryAfterSec: '7' } } }).me?.retryAfterSec).toBe(7)
    expect(parseChatSnapshot(null)).toEqual({ room: { status: 'OPEN', mode: { slowSec: 0, followersMin: null, subsOnly: false } }, me: null })
  })

  it('parses chat events', () => {
    expect(parseChatEvent('ack', { clientMsgId: 'c', messageId: 'm' })).toEqual({ type: 'ack', clientMsgId: 'c', messageId: 'm' })
    expect(parseChatEvent('mode_change', { slowSec: 5, followersMin: 0, subsOnly: false })).toEqual({ type: 'mode_change', mode: { slowSec: 5, followersMin: 0, subsOnly: false } })
    expect(parseChatEvent('room_state', { status: 'READ_ONLY' })).toEqual({ type: 'room_state', status: 'READ_ONLY' })
    expect(parseChatEvent('system', { type: 'MODE_CHANGE', text: 'x', meta: {} })).toBeNull()
    expect(parseChatEvent('system', { type: 'Mode_Change', text: 'x' })).toBeNull()
    expect(parseChatEvent('system', { type: 'notice', text: 'x' })).toEqual({ type: 'system', text: 'x' })
    expect(parseChatEvent('delete', {})).toBeNull()
  })

  it('accepts only relative and http(s) image URLs', () => {
    expect(safeImageUrl('/emotes/a.svg')).toBe('/emotes/a.svg')
    expect(safeImageUrl('https://cdn/x.png')).toBe('https://cdn/x.png')
    expect(safeImageUrl('//evil/x.png')).toBeNull()
    expect(safeImageUrl('data:image/svg+xml,<svg>')).toBeNull()
    expect(parseEmotes({ items: [{ id: '1', code: 'Kappa', imageUrl: '/e/k.svg' }, { code: 'Bad', imageUrl: 'javascript:x' }] })).toHaveLength(1)
  })
})

describe('localFragments', () => {
  it('turns known emote codes and @names into fragments', () => {
    const emotes = new Map([['Kappa', { id: 'e1', code: 'Kappa', imageUrl: '/e/k.svg' }]])
    expect(localFragments('gg Kappa @minh hay', emotes)).toEqual([
      { type: 'text', text: 'gg ' },
      { type: 'emote', text: 'Kappa', emote: { id: 'e1', code: 'Kappa', imageUrl: '/e/k.svg' } },
      { type: 'text', text: ' ' },
      { type: 'mention', text: '@minh', userId: null },
      { type: 'text', text: ' hay' },
    ])
    expect(localFragments('<script>Kappa2', emotes)).toEqual([{ type: 'text', text: '<script>Kappa2' }])
  })
})

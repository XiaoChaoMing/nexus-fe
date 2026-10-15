import { describe, expect, it } from 'vitest'
import { ApiError } from '@/lib/api-error'
import { readMuted, writeMuted } from '../stores/mute-store'
import { parseReportTarget, reportParams } from '../stores/report-store'
import { cleanUsername, customTimeout, durationParts, termError, timeLeft } from './duration'
import { modError } from './errors'
import { parseBlockIds, parseCard, parseModChannels, parseRestrictions, parseRoles, parseTerms } from './parse'
import { canDelete, canRestrict, cardActions, messageMenu, type MessageMenuInput } from './permissions'

describe('messageMenu (Menu/Chat Message)', () => {
  const base: MessageMenuInput = { signedIn: true, canModerate: false, myRole: 'VIEWER', isOwn: false, isSystem: false, deleted: false, pinned: false, authorBadges: [], muted: false, blocked: false }

  it('viewers: report, block, hide — toggled labels when already blocked / hidden', () => {
    expect(messageMenu(base)).toEqual({ mod: [], personal: ['report', 'block', 'mute'] })
    expect(messageMenu({ ...base, blocked: true, muted: true }).personal).toEqual(['report', 'unblock', 'unmute'])
  })

  it('own lines and system lines have no personal items', () => {
    expect(messageMenu({ ...base, isOwn: true })).toEqual({ mod: [], personal: [] })
    expect(messageMenu({ ...base, isSystem: true, canModerate: true })).toEqual({ mod: [], personal: [] })
  })

  it('moderators: delete, timeout, ban, pin, then report', () => {
    const mod = { ...base, canModerate: true, myRole: 'MODERATOR' as const }
    expect(messageMenu(mod)).toEqual({ mod: ['delete', 'timeout', 'ban', 'pin'], personal: ['report'] })
    expect(messageMenu({ ...mod, pinned: true }).mod).toContain('unpin')
    expect(messageMenu({ ...mod, deleted: true }).mod).toEqual(['timeout', 'ban'])
    expect(messageMenu({ ...mod, isOwn: true })).toEqual({ mod: ['delete', 'pin'], personal: [] })
  })

  it('protected authors: no timeout / ban on the owner or another Moderator', () => {
    const mod = { ...base, canModerate: true, myRole: 'MODERATOR' as const }
    expect(messageMenu({ ...mod, authorBadges: ['STREAMER'] }).mod).toEqual(['pin'])
    expect(messageMenu({ ...mod, authorBadges: ['MODERATOR'] }).mod).toEqual(['pin'])
    expect(messageMenu({ ...mod, myRole: 'STREAMER', authorBadges: ['MODERATOR'] }).mod).toEqual(['delete', 'pin'])
    expect(messageMenu({ ...mod, myRole: 'ADMIN', authorBadges: ['MODERATOR'] }).mod).toEqual(['delete', 'timeout', 'ban', 'pin'])
    expect(canRestrict('ADMIN', ['STREAMER'])).toBe(false)
    expect(canDelete('MODERATOR', ['VIP'], false)).toBe(true)
  })
})

describe('cardActions (Chat/User Card)', () => {
  const card = { role: null, restriction: null }
  const now = Date.parse('2026-10-15T10:00:00Z')
  const base = { card, canModerate: false, myRole: 'VIEWER' as const, isSelf: false, blocked: false, muted: false, now }

  it('viewer → report, block, hide; blocked → unblock', () => {
    expect(cardActions(base)).toEqual({ primary: ['report', 'block'], roles: [], secondary: ['mute'] })
    expect(cardActions({ ...base, blocked: true }).primary).toEqual(['report', 'unblock'])
    expect(cardActions({ ...base, isSelf: true })).toEqual({ primary: [], roles: [], secondary: [] })
  })

  it('moderator → by restriction; protected targets only get report', () => {
    const mod = { ...base, canModerate: true, myRole: 'MODERATOR' as const }
    expect(cardActions(mod).primary).toEqual(['timeout', 'ban', 'report'])
    expect(cardActions({ ...mod, card: { role: null, restriction: { type: 'TIMEOUT' as const, until: '2026-10-15T10:10:00Z' } } }).primary).toEqual(['untimeout', 'ban'])
    expect(cardActions({ ...mod, card: { role: null, restriction: { type: 'TIMEOUT' as const, until: '2026-10-15T09:00:00Z' } } }).primary).toEqual(['timeout', 'ban', 'report'])
    expect(cardActions({ ...mod, card: { role: null, restriction: { type: 'BAN' as const, until: null } } }).primary).toEqual(['unban'])
    expect(cardActions({ ...mod, card: { role: 'MODERATOR' as const, restriction: null } }).primary).toEqual(['report'])
    expect(cardActions({ ...mod, card: { role: 'OWNER' as const, restriction: null } }).primary).toEqual(['report'])
    expect(cardActions(mod).roles).toEqual([])
  })

  it('owner also assigns roles', () => {
    const owner = { ...base, canModerate: true, myRole: 'STREAMER' as const }
    expect(cardActions(owner).roles).toEqual(['makeMod', 'makeVip'])
    expect(cardActions({ ...owner, card: { role: 'MODERATOR' as const, restriction: null } })).toEqual({ primary: ['report'], roles: ['removeMod'], secondary: ['block', 'mute'] })
    expect(cardActions({ ...owner, card: { role: 'VIP' as const, restriction: null } }).roles).toEqual(['makeMod', 'removeVip'])
  })
})

describe('durations', () => {
  it('custom timeout: whole positive amounts up to 14 days', () => {
    expect(customTimeout('15', 'min')).toEqual({ ok: true, sec: 900 })
    expect(customTimeout('14', 'day')).toEqual({ ok: true, sec: 1_209_600 })
    expect(customTimeout('15', 'day')).toEqual({ ok: false, error: 'max' })
    expect(customTimeout('0', 'sec')).toEqual({ ok: false, error: 'min' })
    expect(customTimeout('1.5', 'hour')).toEqual({ ok: false, error: 'min' })
    expect(customTimeout('', 'hour')).toEqual({ ok: false, error: 'min' })
  })

  it('largest whole unit and time left', () => {
    expect(durationParts(600)).toEqual({ unit: 'min', count: 10 })
    expect(durationParts(3600)).toEqual({ unit: 'hour', count: 1 })
    expect(durationParts(172_800)).toEqual({ unit: 'day', count: 2 })
    expect(durationParts(90)).toEqual({ unit: 'sec', count: 90 })
    const now = Date.parse('2026-10-15T10:00:00Z')
    expect(timeLeft('2026-10-15T10:09:41Z', now)).toEqual({ clock: '9:41' })
    expect(timeLeft('2026-10-15T11:02:05Z', now)).toEqual({ clock: '1:02:05' })
    expect(timeLeft('2026-10-18T10:00:00Z', now)).toEqual({ days: 3 })
    expect(timeLeft('2026-10-15T09:00:00Z', now)).toEqual({ clock: '0:00' })
    expect(timeLeft(null, now)).toBeNull()
  })

  it('terms and usernames', () => {
    expect(termError('a')).toBe('length')
    expect(termError('  lừa   đảo ')).toBeNull()
    expect(termError('x'.repeat(101))).toBe('length')
    expect(cleanUsername(' @@tuananh99 ')).toBe('tuananh99')
  })
})

describe('modError', () => {
  it('maps refusals to the toasts of design 03e', () => {
    expect(modError(new ApiError(403, 'FORBIDDEN', '', { target: 'PROTECTED' }), 'timeout')).toEqual({ key: 'error.protected', lostRole: false })
    expect(modError(new ApiError(403, 'FORBIDDEN', ''), 'delete')).toEqual({ key: 'error.forbidden', lostRole: true })
    expect(modError(new ApiError(409, 'INVALID_STATE', ''), 'pin').key).toBe('error.pinInvalid')
    expect(modError(new ApiError(409, 'INVALID_STATE', ''), 'timeout').key).toBe('error.alreadyBanned')
    expect(modError(new ApiError(409, 'CHAT_READ_ONLY', ''), 'pin').key).toBe('error.readOnly')
    expect(modError(new Error('x'), 'ban').key).toBe('error.failed')
  })
})

describe('moderation parsers', () => {
  it('restrictions, roles, cards, terms, channels, block ids', () => {
    const r = parseRestrictions({ items: [{ user: { id: 'u', username: 'an' }, type: 'TIMEOUT', until: '2026-10-15T10:00:00Z', actor: { id: 'm', username: 'mod' }, reason: null, createdAt: '2026-10-15T09:50:00Z' }, { type: 'X' }], nextCursor: null })
    expect(r.items).toEqual([{ user: { id: 'u', username: 'an', displayName: 'an' }, type: 'TIMEOUT', until: '2026-10-15T10:00:00Z', actor: { id: 'm', username: 'mod' }, reason: null, createdAt: '2026-10-15T09:50:00Z' }])
    expect(parseRoles({ items: [{ user: { id: 'u', username: 'an' }, role: 'VIP', grantedBy: null, createdAt: 'x' }, { user: { id: 'v' }, role: 'OWNER' }] }).items).toHaveLength(1)
    expect(parseCard({ user: { id: 'u', username: 'an' }, badges: ['MOD', 'VIP', 'MOD'], role: 'OWNER', restriction: { type: 'BAN', until: null } })).toMatchObject({ role: 'OWNER', badges: ['MODERATOR', 'VIP'], restriction: { type: 'BAN', until: null } })
    expect(parseCard({ user: {} })).toBeNull()
    expect(parseTerms({ items: [{ id: 't', term: 'spam' }, { id: 'x' }], limit: 100 })).toMatchObject({ items: [{ id: 't', term: 'spam' }], limit: 100 })
    expect(parseModChannels({ items: [{ channel: { id: 'c', handle: 'k', isLive: true }, role: 'MODERATOR' }] })).toEqual([{ channel: { id: 'c', handle: 'k', displayName: 'k', avatarUrl: null, isLive: true }, role: 'MODERATOR' }])
    expect(parseBlockIds({ items: [{ userId: 'a' }, { userId: '' }], nextCursor: null })).toEqual(['a'])
    expect(parseBlockIds({ ids: ['b'] })).toEqual(['b'])
  })
})

describe('client-side lists', () => {
  it('mute lists per account in sessionStorage, tolerant of junk', () => {
    const mem = new Map<string, string>()
    const s = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) }
    writeMuted('me', ['a', 'b'], s)
    expect(readMuted('me', s)).toEqual(['a', 'b'])
    expect(readMuted('other', s)).toEqual([])
    mem.set('nxl.muted.bad', '{')
    expect(readMuted('bad', s)).toEqual([])
  })

  it('report targets survive the sign-in modal as JSON', () => {
    const target = { type: 'CHANNEL' as const, id: 'c', displayName: 'K', handle: 'k', avatarUrl: null }
    expect(parseReportTarget(reportParams(target).target)).toEqual(target)
    expect(parseReportTarget('{"type":"MESSAGE","id":"m"}')).toBeNull()
    expect(parseReportTarget('nope')).toBeNull()
    expect(parseReportTarget(undefined)).toBeNull()
  })
})

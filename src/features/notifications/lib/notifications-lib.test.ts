import { describe, expect, it } from 'vitest'
import type { AppNotification, NotificationPage } from '../types'
import { ageGroup, groupByAge, markAllReadInPages, markReadInPages, minutesUntil, removeFromPages, shouldToast, TOAST_WINDOW_MS, upsertInPages } from './center'
import { parseCount, parseNotification, parseNotificationPage, parseSettings, parseUnsubscribed, safeLink } from './parse'
import { sentenceOf } from './sentence'

const channel = { id: 'c1', handle: 'kaelen', displayName: 'Kaelen', avatarUrl: '/media/a.jpg' }

function n(over: Partial<AppNotification> = {}): AppNotification {
  return {
    id: 'n1',
    payload: { type: 'CREATOR_LIVE', channel, streamId: 's1', title: 'Leo rank' },
    link: '/live/s1',
    groupCount: 1,
    read: false,
    createdAt: '2026-10-15T10:00:00Z',
    updatedAt: '2026-10-15T10:00:00Z',
    ...over,
  }
}

describe('parseNotification', () => {
  it('reads the CREATOR_LIVE payload and keeps app links', () => {
    const parsed = parseNotification({
      id: 'x',
      type: 'CREATOR_LIVE',
      payload: { channel: { id: 'c1', handle: 'kaelen', displayName: 'Kaelen', avatarUrl: 'javascript:alert(1)' }, streamId: 's1', title: 'T' },
      link: '/live/s1',
      groupCount: 1,
      read: false,
      createdAt: '2026-10-15T10:00:00Z',
      updatedAt: '2026-10-15T10:05:00Z',
    })
    expect(parsed).toMatchObject({ id: 'x', link: '/live/s1', updatedAt: '2026-10-15T10:05:00Z', payload: { type: 'CREATOR_LIVE', streamId: 's1', channel: { avatarUrl: null } } })
  })

  it('drops items without id, maps unknown types to UNKNOWN and falls back on dates and counts', () => {
    expect(parseNotification({ type: 'MENTION' })).toBeNull()
    const odd = parseNotification({ id: 'y', type: 'VOD_READY', groupCount: -2, createdAt: 'nope' })
    expect(odd).toMatchObject({ payload: { type: 'UNKNOWN' }, groupCount: 1, read: false, link: null })
  })

  it('reads every payload shape', () => {
    const p = (type: string, payload: unknown) => parseNotification({ id: 'z', type, payload, createdAt: '2026-10-15T10:00:00Z' })?.payload
    expect(p('SCHEDULE', { channel, title: 'A', occurrenceAt: '2026-10-17T13:00:00Z', reason: 'MOVED', newOccurrenceAt: '2026-10-18T14:00:00Z' })).toMatchObject({ reason: 'MOVED', newOccurrenceAt: '2026-10-18T14:00:00Z' })
    expect(p('SCHEDULE', { reason: 'WHATEVER' })).toMatchObject({ reason: 'SERIES_CHANGED' })
    expect(p('MENTION', { channel, streamId: 's', lastSender: { id: 'u', username: 'linh' }, excerpt: '@minh hi' })).toMatchObject({ lastSender: { displayName: 'linh' } })
    expect(p('CREATOR_APPLICATION', { result: 'APPROVED', reason: null })).toEqual({ type: 'CREATOR_APPLICATION', result: 'APPROVED', reason: null })
    expect(p('REPORT_RESULT', { result: 'DISMISSED' })).toEqual({ type: 'REPORT_RESULT', result: 'DISMISSED' })
    expect(p('SYSTEM', { kind: 'STREAM_TAKEDOWN', reason: 'r', title: 'T' })).toEqual({ type: 'SYSTEM', kind: 'STREAM_TAKEDOWN', reason: 'r', title: 'T' })
    expect(p('SYSTEM', { kind: 'NEW_KIND' })).toEqual({ type: 'UNKNOWN' })
  })

  it('pages, counts, settings and unsubscribe answers', () => {
    expect(parseNotificationPage({ items: [{ id: 'a', type: 'REPORT_RESULT' }, null], nextCursor: 'c' })).toMatchObject({ items: [{ id: 'a' }], nextCursor: 'c' })
    expect(parseCount({ count: 3 })).toBe(3)
    expect(parseCount({ count: 'x' })).toBe(0)
    const s = parseSettings({ emailVerified: true, items: [{ type: 'SYSTEM', inApp: true, email: true, inAppLocked: true, emailLocked: true }, { type: 'CREATOR_LIVE', inApp: true, email: false }, { type: 'BOGUS' }] })
    expect(s.items.map((i) => i.type)).toEqual(['CREATOR_LIVE', 'SYSTEM'])
    expect(s.items[0]).toMatchObject({ email: false, emailAvailable: true })
    expect(parseUnsubscribed({ type: 'CREATOR_LIVE' })).toBe('CREATOR_LIVE')
    expect(parseUnsubscribed({})).toBeNull()
  })
})

describe('safeLink', () => {
  it('follows app paths only and maps the old dashboard path', () => {
    expect(safeLink('/live/s1')).toBe('/live/s1')
    expect(safeLink('/kaelen?tab=schedule')).toBe('/kaelen?tab=schedule')
    expect(safeLink('/studio/dashboard')).toBe('/studio')
    expect(safeLink('//evil.example')).toBeNull()
    expect(safeLink('https://evil.example')).toBeNull()
    expect(safeLink(null)).toBeNull()
  })
})

describe('notification pages', () => {
  const pages: NotificationPage[] = [
    { items: [n({ id: 'b', updatedAt: '2026-10-15T09:00:00Z' }), n({ id: 'a', updatedAt: '2026-10-15T08:00:00Z', read: true })], nextCursor: 'x' },
    { items: [n({ id: 'z', updatedAt: '2026-10-14T08:00:00Z' })], nextCursor: null },
  ]

  it('a regrouped item moves to the top and is not duplicated', () => {
    const next = upsertInPages(pages, n({ id: 'z', updatedAt: '2026-10-15T11:00:00Z', groupCount: 3 }), 'all')
    expect(next[0].items.map((i) => i.id)).toEqual(['z', 'b', 'a'])
    expect(next[1].items).toHaveLength(0)
  })

  it('the unread list drops read items; an empty cache gets a first page', () => {
    expect(upsertInPages(pages, n({ id: 'b', read: true }), 'unread')[0].items.map((i) => i.id)).toEqual(['a'])
    expect(upsertInPages([], n(), 'all')).toEqual([{ items: [n()], nextCursor: null }])
  })

  it('read one, read all up to a time, delete', () => {
    expect(markReadInPages(pages, 'b', 'all')[0].items[0].read).toBe(true)
    expect(markReadInPages(pages, 'b', 'unread')[0].items.map((i) => i.id)).toEqual(['a'])
    const all = markAllReadInPages(pages, '2026-10-15T08:30:00Z', 'all')
    expect(all[0].items.map((i) => i.read)).toEqual([false, true])
    expect(all[1].items[0].read).toBe(true)
    expect(removeFromPages(pages, 'a')[0].items.map((i) => i.id)).toEqual(['b'])
  })
})

describe('age groups', () => {
  const now = new Date(2026, 9, 15, 12, 0).getTime()
  it('today, yesterday, last 7 days, older (local days)', () => {
    expect(ageGroup(new Date(2026, 9, 15, 0, 5).toISOString(), now)).toBe('today')
    expect(ageGroup(new Date(2026, 9, 14, 23, 59).toISOString(), now)).toBe('yesterday')
    expect(ageGroup(new Date(2026, 9, 9, 10).toISOString(), now)).toBe('week')
    expect(ageGroup(new Date(2026, 9, 8, 10).toISOString(), now)).toBe('older')
  })

  it('consecutive items share a group', () => {
    const groups = groupByAge([n({ id: '1', updatedAt: new Date(2026, 9, 15, 9).toISOString() }), n({ id: '2', updatedAt: new Date(2026, 9, 15, 8).toISOString() }), n({ id: '3', updatedAt: new Date(2026, 9, 14, 8).toISOString() })], now)
    expect(groups.map((g) => [g.group, g.items.length])).toEqual([
      ['today', 2],
      ['yesterday', 1],
    ])
  })
})

describe('live toast rules', () => {
  const now = Date.parse('2026-10-15T10:00:30Z')
  const base = { n: n(), now, lastToastAt: null, pathname: '/', known: false }

  it('a fresh live notification toasts once per window, never on its own watch page', () => {
    expect(shouldToast(base)).toBe(true)
    expect(shouldToast({ ...base, lastToastAt: now - TOAST_WINDOW_MS + 1 })).toBe(false)
    expect(shouldToast({ ...base, lastToastAt: now - TOAST_WINDOW_MS })).toBe(true)
    expect(shouldToast({ ...base, pathname: '/live/s1' })).toBe(false)
    expect(shouldToast({ ...base, known: true })).toBe(false)
    expect(shouldToast({ ...base, n: n({ read: true }) })).toBe(false)
  })

  it('other types and replays of old items do not toast', () => {
    expect(shouldToast({ ...base, n: n({ payload: { type: 'REPORT_RESULT', result: 'RESOLVED' } }) })).toBe(false)
    expect(shouldToast({ ...base, now: now + 10 * 60_000 })).toBe(false)
  })

  it('minutes before a reminder', () => {
    expect(minutesUntil('2026-10-15T10:10:00Z', '2026-10-15T10:00:00Z')).toBe(10)
    expect(minutesUntil(null, '2026-10-15T10:00:00Z')).toBe(10)
    expect(minutesUntil('2026-10-15T10:00:10Z', '2026-10-15T10:00:00Z')).toBe(1)
  })
})

describe('sentenceOf (NXL-E §7.4)', () => {
  const fb = { channel: 'Một kênh', person: 'Một người dùng' }

  it('picks the key and values of each type', () => {
    expect(sentenceOf(n(), fb)).toEqual({ key: 'item.creatorLive', values: { channel: 'Kaelen', title: 'Leo rank' } })
    expect(sentenceOf(n({ payload: { type: 'CREATOR_LIVE', channel: null, streamId: 's', title: 'T' } }), fb).values.channel).toBe('Một kênh')
    expect(sentenceOf(n({ groupCount: 3, payload: { type: 'MENTION', channel, streamId: 's', lastSender: { id: 'u', username: 'linh', displayName: 'LinhChi' }, excerpt: 'hi' } }), fb)).toEqual({
      key: 'item.mentionGrouped',
      values: { sender: 'LinhChi', channel: 'Kaelen', excerpt: 'hi', count: 3 },
    })
    expect(sentenceOf(n({ groupCount: 13, payload: { type: 'NEW_FOLLOWER', lastFollower: { id: 'u', username: 'an', displayName: 'An' } } }), fb)).toEqual({ key: 'item.followerGrouped', values: { name: 'An', count: 12 } })
    expect(sentenceOf(n({ payload: { type: 'NEW_FOLLOWER', lastFollower: null } }), fb)).toEqual({ key: 'item.follower', values: { name: 'Một người dùng' } })
    expect(sentenceOf(n({ payload: { type: 'REPORT_RESULT', result: 'DISMISSED' } }), fb).key).toBe('item.reportDismissed')
    expect(sentenceOf(n({ payload: { type: 'CREATOR_APPLICATION', result: 'REJECTED', reason: null } }), fb).key).toBe('item.creatorRejectedNoReason')
    expect(sentenceOf(n({ payload: { type: 'SYSTEM', kind: 'CHANNEL_SUSPENDED', reason: 'Bạo lực', title: null } }), fb)).toEqual({ key: 'item.channelSuspended', values: { reason: 'Bạo lực' } })
    expect(sentenceOf(n({ payload: { type: 'SYSTEM', kind: 'STREAM_TAKEDOWN', reason: '', title: null } }), fb).key).toBe('item.streamTakedownNoTitle')
    expect(sentenceOf(n({ payload: { type: 'SCHEDULE', channel, title: 'A', occurrenceAt: null, newOccurrenceAt: null, reason: 'SERIES_CHANGED' } }), fb)).toEqual({ key: 'item.scheduleSeries', values: { title: 'A' } })
    expect(sentenceOf(n({ payload: { type: 'UNKNOWN' } }), fb).key).toBe('item.unknown')
  })

  it('reminders count minutes from the notification time', () => {
    const s = sentenceOf(n({ createdAt: '2026-10-15T10:00:00Z', payload: { type: 'STREAM_STARTING', channel, occurrenceAt: '2026-10-15T10:10:00Z', title: 'T' } }), fb)
    expect(s).toEqual({ key: 'item.streamStarting', values: { channel: 'Kaelen', title: 'T', count: 10 } })
  })
})

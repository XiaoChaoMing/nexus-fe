import { describe, expect, it } from 'vitest'
import { applyFollowOp, bellKind, settleFollow, type FollowView } from './follow-state'
import { handleError, handleFromSegment, isReservedHandle, profilePath } from './handle'
import { groupByDay } from './schedule-days'
import { applySidebarEvent, sidebarFromResponse, type SidebarState } from './sidebar'
import type { FollowedChannel } from '@/features/channels/types'

describe('follow optimistic reducer', () => {
  const none: FollowView = { following: false, notifyLevel: null, followerCount: 10 }

  it('follows with the default bell and counts the follower', () => {
    expect(applyFollowOp(none, { type: 'follow' })).toEqual({ following: true, notifyLevel: 'ALL', followerCount: 11 })
  })

  it('ignores a repeated follow or an unfollow of a channel not followed', () => {
    const followed = applyFollowOp(none, { type: 'follow' })
    expect(applyFollowOp(followed, { type: 'follow' })).toBe(followed)
    expect(applyFollowOp(none, { type: 'unfollow' })).toBe(none)
  })

  it('unfollows, never counting below zero, and keeps an unknown count unknown', () => {
    expect(applyFollowOp({ following: true, notifyLevel: 'OFF', followerCount: 0 }, { type: 'unfollow' })).toEqual({ following: false, notifyLevel: null, followerCount: 0 })
    expect(applyFollowOp({ following: false, notifyLevel: null, followerCount: null }, { type: 'follow' }).followerCount).toBeNull()
  })

  it('changes the bell only while following', () => {
    const followed = applyFollowOp(none, { type: 'follow' })
    expect(applyFollowOp(followed, { type: 'setLevel', level: 'LIVE_ONLY' }).notifyLevel).toBe('LIVE_ONLY')
    expect(applyFollowOp(none, { type: 'setLevel', level: 'OFF' })).toBe(none)
  })

  it('rolls back to the snapshot and settles on the server answer', () => {
    const before = none
    const optimistic = applyFollowOp(before, { type: 'follow' })
    // A failed request restores the snapshot taken before the optimistic change.
    expect(before).toEqual({ following: false, notifyLevel: null, followerCount: 10 })
    expect(settleFollow(optimistic, { following: true, notifyLevel: 'ALL' })).toBe(optimistic)
    expect(settleFollow(optimistic, { following: true, notifyLevel: 'LIVE_ONLY' }).notifyLevel).toBe('LIVE_ONLY')
  })

  it('picks the bell icon by level', () => {
    expect([bellKind('ALL'), bellKind('LIVE_ONLY'), bellKind('OFF'), bellKind(null)]).toEqual(['active', 'plain', 'off', 'active'])
  })
})

describe('profile routes and reserved words', () => {
  it('rejects app routes and malformed segments', () => {
    for (const word of ['login', 'Studio', 'browse', 'search', 'following', 'live', 'vod', 'c', 'settings', 'dev']) {
      expect(handleFromSegment(word)).toBeNull()
    }
    expect(handleFromSegment('a')).toBeNull()
    expect(handleFromSegment('x'.repeat(31))).toBeNull()
    expect(handleFromSegment('bad%2Fpath')).toBeNull()
    expect(handleFromSegment('%E0%A4%A')).toBeNull()
    expect(handleFromSegment(undefined)).toBeNull()
  })

  it('accepts handles, lower-cased, with an optional @', () => {
    expect(handleFromSegment('Kaelen')).toBe('kaelen')
    expect(handleFromSegment('@maianh.vlog')).toBe('maianh.vlog')
    expect(handleFromSegment('creator_01')).toBe('creator_01')
  })

  it('links reserved handles through /c/', () => {
    expect(profilePath('kaelen')).toBe('/kaelen')
    expect(profilePath('studio')).toBe('/c/studio')
    expect(isReservedHandle('NEXUSLIVE')).toBe(true)
  })

  it('validates a new handle like the server', () => {
    expect(handleError('new_name1')).toBeNull()
    expect(handleError('ab')).toBe('FORMAT')
    expect(handleError('Upper')).toBe('FORMAT')
    expect(handleError('with.dot')).toBe('FORMAT')
    expect(handleError('settings')).toBe('INVALID')
  })
})

const card = (id: string) => ({ id, handle: id, displayName: id.toUpperCase(), avatarUrl: null, verified: false })
const followed = (id: string, viewers: number | null): FollowedChannel => ({
  channel: card(id),
  isLive: viewers !== null,
  currentStream: viewers === null ? null : { id: `s-${id}`, title: `t-${id}`, category: null, viewerCount: viewers, isMature: false, startedAt: '2026-10-14T10:00:00Z' },
  lastLiveAt: null,
  notifyLevel: 'ALL',
  followedAt: '2026-10-01T00:00:00Z',
})

describe('sidebar realtime reducer', () => {
  const base: SidebarState = sidebarFromResponse({ live: [followed('a', 500), followed('b', 100)], offline: [followed('c', null), followed('d', null)], totalFollowing: 4 })
  const order = (s: SidebarState) => s.entries.map((e) => `${e.channel.id}${e.stream ? '*' : ''}`)

  it('moves a channel that went live into the live group by viewers', () => {
    const { state } = applySidebarEvent(base, 'channel_live', { channelId: 'd', stream: { id: 's-d', title: 'Mới', categoryId: 'cat', viewerCount: 200 } })
    expect(order(state)).toEqual(['a*', 'd*', 'b*', 'c'])
    expect(state.entries[1]?.stream).toEqual({ id: 's-d', title: 'Mới', categoryId: 'cat', viewerCount: 200 })
  })

  it('puts a live channel without a count at the end of the live group', () => {
    const { state } = applySidebarEvent(base, 'channel_live', { channelId: 'c', stream: { id: 's-c', title: 'x', categoryId: null, viewerCount: null } })
    expect(order(state)).toEqual(['a*', 'b*', 'c*', 'd'])
  })

  it('moves a channel that ended to the top of the offline group', () => {
    const { state } = applySidebarEvent(base, 'channel_offline', { channelId: 'a', streamId: 's-a', lastLiveAt: '2026-10-14T12:00:00Z' })
    expect(order(state)).toEqual(['b*', 'a', 'c', 'd'])
    expect(state.entries[1]?.lastLiveAt).toBe('2026-10-14T12:00:00Z')
  })

  it('updates counts in place without reordering', () => {
    const { state } = applySidebarEvent(base, 'viewer_count_batch', { items: [{ channelId: 'b', streamId: 's-b', count: 9000 }, { channelId: 'zz', count: 1 }] })
    expect(order(state)).toEqual(order(base))
    expect(state.entries[1]?.stream?.viewerCount).toBe(9000)
    expect(applySidebarEvent(base, 'viewer_count_batch', { items: [] }).state).toBe(base)
  })

  it('flags channels it does not know and ignores malformed events', () => {
    expect(applySidebarEvent(base, 'channel_live', { channelId: 'new', stream: { id: 's' } }).unknownChannel).toBe(true)
    expect(applySidebarEvent(base, 'channel_live', { channelId: 'a' }).state).toBe(base)
    expect(applySidebarEvent(base, 'channel_offline', { channelId: 'c' }).state).toBe(base)
    expect(applySidebarEvent(base, 'something', null).state).toBe(base)
  })
})

describe('schedule day groups', () => {
  const tz = 'Asia/Ho_Chi_Minh'
  const now = Date.parse('2026-10-14T05:00:00Z') // 12:00 in Vietnam

  it('labels today, tomorrow and later days in the viewer zone', () => {
    const items = ['2026-10-17T13:00:00Z', '2026-10-14T13:00:00Z', '2026-10-14T18:00:00Z', '2026-10-15T13:00:00Z']
    const groups = groupByDay(items, (s) => Date.parse(s), now, tz)
    expect(groups.map((g) => [g.key, g.label.kind, g.items.length])).toEqual([
      ['2026-10-14', 'today', 1],
      ['2026-10-15', 'tomorrow', 2], // 18:00Z on the 14th is 01:00 on the 15th in Vietnam
      ['2026-10-17', 'date', 1],
    ])
  })
})

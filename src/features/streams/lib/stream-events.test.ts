import { describe, expect, it } from 'vitest'
import { applyStreamEvent, applyStreamSnapshot } from './stream-events'
import type { Stream } from '../types'

const stream: Stream = {
  id: 's1',
  channelId: 'c1',
  title: 'Old',
  tags: ['a'],
  language: 'vi',
  isMature: false,
  status: 'LIVE',
  startedAt: '2026-10-14T10:00:00Z',
  endedAt: null,
  endReason: null,
  manifestUrl: '',
  thumbnailUrl: '',
  vodId: null,
  viewerCount: null,
}

describe('stream events', () => {
  it('applies the snapshot', () => {
    expect(applyStreamSnapshot(stream, { status: 'INTERRUPTED', viewerCount: 12 })).toMatchObject({ status: 'INTERRUPTED', viewerCount: 12 })
    expect(applyStreamSnapshot(stream, { status: 'LIVE', viewerCount: null })).toBe(stream)
  })

  it('status_changed to ENDED stamps endedAt and keeps a known reason', () => {
    const s = applyStreamEvent(stream, 'status_changed', { status: 'ENDED', endReason: 'creator' }, Date.parse('2026-10-14T11:00:00Z'))
    expect(s).toMatchObject({ status: 'ENDED', endedAt: '2026-10-14T11:00:00.000Z', endReason: 'creator' })
    expect(applyStreamEvent(stream, 'status_changed', { status: 'BOGUS' })).toBe(stream)
  })

  it('viewer_count, title_changed, vod_ready', () => {
    expect(applyStreamEvent(stream, 'viewer_count', { count: 1234 }).viewerCount).toBe(1234)
    expect(applyStreamEvent(stream, 'viewer_count', { count: -1 })).toBe(stream)
    expect(applyStreamEvent(stream, 'title_changed', { title: 'New', tags: ['x', 1] })).toMatchObject({ title: 'New', tags: ['x'] })
    expect(applyStreamEvent(stream, 'vod_ready', { vodId: 'v1' }).vodId).toBe('v1')
    expect(applyStreamEvent(stream, 'unknown', {})).toBe(stream)
  })
})

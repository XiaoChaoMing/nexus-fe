import { describe, expect, it } from 'vitest'
import { applyStreamEvent, applyStreamSnapshot } from './stream-events'
import type { Stream, StreamDetail } from '../types'

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

describe('scheduled broadcasts (GĐ4)', () => {
  const upcoming: StreamDetail = { ...stream, status: 'SCHEDULED', startedAt: null, scheduleId: 'sch', scheduledStartAt: '2026-10-14T13:00:00Z' }

  it('goes live from SCHEDULED and stamps the start', () => {
    const live = applyStreamEvent(upcoming, 'status_changed', { status: 'LIVE' }, Date.parse('2026-10-14T12:50:00Z'))
    expect(live.status).toBe('LIVE')
    expect(live.startedAt).toBe('2026-10-14T12:50:00.000Z')
  })

  it('cancels, and moves the start of a rescheduled broadcast', () => {
    expect(applyStreamEvent(upcoming, 'status_changed', { status: 'CANCELLED' }).status).toBe('CANCELLED')
    const moved = applyStreamEvent(upcoming, 'status_changed', { status: 'SCHEDULED', scheduledStartAt: '2026-10-15T13:00:00Z' })
    expect(moved.scheduledStartAt).toBe('2026-10-15T13:00:00Z')
    expect(applyStreamSnapshot(upcoming, { status: 'SCHEDULED', viewerCount: null })).toMatchObject({ status: 'SCHEDULED', viewerCount: null })
  })
})

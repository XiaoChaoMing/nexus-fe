import { describe, expect, it } from 'vitest'
import type { Stream } from '@/features/streams/types'
import { featuredStream, thumbSrc, watchedPercent } from './featured'

const stream = (id: string, status: Stream['status'], startedAt: string | null): Stream => ({
  id,
  channelId: 'c',
  title: id,
  tags: [],
  language: 'vi',
  isMature: false,
  status,
  startedAt,
  endedAt: null,
  endReason: null,
  manifestUrl: '',
  thumbnailUrl: '',
  vodId: null,
})

describe('featured stream', () => {
  it('picks the most recently started live stream', () => {
    const items = [
      stream('old', 'LIVE', '2026-10-14T08:00:00Z'),
      stream('new', 'LIVE', '2026-10-14T10:00:00Z'),
      stream('newest-but-interrupted', 'INTERRUPTED', '2026-10-14T11:00:00Z'),
    ]
    expect(featuredStream(items)?.id).toBe('new')
  })

  it('falls back to an interrupted stream, then to nothing', () => {
    expect(featuredStream([stream('i', 'INTERRUPTED', null)])?.id).toBe('i')
    expect(featuredStream([])).toBeNull()
    expect(featuredStream(undefined)).toBeNull()
  })

  it('keeps a stream without a start time last', () => {
    expect(featuredStream([stream('a', 'LIVE', null), stream('b', 'LIVE', '2026-01-01T00:00:00Z')])?.id).toBe('b')
  })
})

describe('card helpers', () => {
  it('computes the watched percentage', () => {
    expect(watchedPercent(3024, 4200)).toBe(72)
    expect(watchedPercent(10, 0)).toBe(0)
    expect(watchedPercent(5000, 4200)).toBe(100)
  })

  it('adds a per-minute cache buster', () => {
    expect(thumbSrc('/t.jpg', 120_000)).toBe('/t.jpg?t=2')
    expect(thumbSrc('/t.jpg?a=1', 60_000)).toBe('/t.jpg?a=1&t=1')
  })
})

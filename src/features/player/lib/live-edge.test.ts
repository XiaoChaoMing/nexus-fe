import { describe, expect, it } from 'vitest'
import { behindLive, clampLiveSeek, formatBehind, formatClock, isAtLiveEdge } from './live-edge'

describe('live edge', () => {
  it('measures how far the viewer is behind', () => {
    expect(behindLive(100, 90)).toBe(10)
    expect(behindLive(100, 105)).toBe(0)
    expect(behindLive(null, 50)).toBe(0)
  })

  it('treats three segments as live', () => {
    expect(isAtLiveEdge(6)).toBe(true)
    expect(isAtLiveEdge(6.1)).toBe(false)
  })

  it('formats clocks and the rewind label', () => {
    expect(formatClock(75)).toBe('1:15')
    expect(formatClock(3725)).toBe('1:02:05')
    expect(formatBehind(312)).toBe('-05:12')
    expect(formatBehind(3725)).toBe('-1:02:05')
  })

  it('never seeks past the live edge', () => {
    expect(clampLiveSeek(500, 0, 120)).toBe(120)
    expect(clampLiveSeek(-5, 0, 120)).toBe(0)
    expect(clampLiveSeek(60, 0, 120)).toBe(60)
  })
})

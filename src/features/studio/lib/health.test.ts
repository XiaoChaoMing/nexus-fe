import { describe, expect, it } from 'vitest'
import type { Health } from '@/features/streams/types'
import { appendSample, droppedDeltas, healthWarnings } from './health'

const sample = (reportedAt: string, over: Partial<Health> = {}): Health => ({
  fps: 30,
  bitrateKbps: 4500,
  droppedFrames: 0,
  speed: 1,
  uploadErrors: 0,
  reportedAt,
  ...over,
})

describe('appendSample', () => {
  it('adds new reports once and keeps the newest', () => {
    let h = appendSample([], sample('a'))
    h = appendSample(h, sample('a'))
    h = appendSample(h, null)
    expect(h).toHaveLength(1)
    h = appendSample(h, sample('b'), 1)
    expect(h.map((x) => x.reportedAt)).toEqual(['b'])
  })
})

describe('droppedDeltas', () => {
  it('turns the cumulative counter into per-report drops', () => {
    expect(droppedDeltas([sample('a', { droppedFrames: 2 }), sample('b', { droppedFrames: 5 }), sample('c', { droppedFrames: 5 })])).toEqual([0, 3, 0])
  })
})

describe('healthWarnings', () => {
  it('is empty for a healthy ingest and explains each problem', () => {
    expect(healthWarnings(sample('a'))).toEqual([])
    expect(healthWarnings(sample('a', { speed: 0.7, bitrateKbps: 8000, uploadErrors: 2 })).map((w) => w.key)).toEqual([
      'studio:health.warnings.slow',
      'studio:health.warnings.bitrate',
      'studio:health.warnings.upload',
    ])
  })
})

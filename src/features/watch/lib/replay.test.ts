import { describe, expect, it } from 'vitest'
import { replayState, VOD_WAIT_MS } from './replay'

describe('replay state after a broadcast ends', () => {
  const endedAt = '2026-10-14T10:00:00Z'
  const ended = Date.parse(endedAt)

  it('offers the replay once the VOD exists', () => {
    expect(replayState({ vodId: 'v1', endedAt }, ended + 10 * VOD_WAIT_MS)).toBe('ready')
  })

  it('waits for processing, then gives up', () => {
    expect(replayState({ vodId: null, endedAt }, ended + 5_000)).toBe('processing')
    expect(replayState({ vodId: null, endedAt }, ended + VOD_WAIT_MS + 1)).toBe('none')
    expect(replayState({ vodId: null, endedAt: null }, ended)).toBe('processing')
  })
})

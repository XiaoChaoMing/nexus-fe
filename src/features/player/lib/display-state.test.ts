import { describe, expect, it } from 'vitest'
import { displayState, type DisplayInput } from './display-state'

const base: DisplayInput = {
  apiStatus: 'LIVE',
  phase: 'playing',
  buffering: false,
  videoEnded: false,
  atLiveEdge: true,
  matureBlocked: false,
}

describe('displayState', () => {
  it('shows live while playing', () => {
    expect(displayState(base)).toBe('live')
    expect(displayState({ ...base, buffering: true })).toBe('buffering')
    expect(displayState({ ...base, phase: 'loading' })).toBe('loading')
    expect(displayState({ ...base, phase: 'reconnecting' })).toBe('reconnecting')
  })

  it('shows the mature gate first', () => {
    expect(displayState({ ...base, matureBlocked: true, apiStatus: 'ENDED' })).toBe('mature')
  })

  it('shows interrupted only at the live edge', () => {
    const interrupted = { ...base, apiStatus: 'INTERRUPTED' as const, buffering: true }
    expect(displayState(interrupted)).toBe('interrupted')
    expect(displayState({ ...interrupted, atLiveEdge: false, buffering: false })).toBe('live')
  })

  it('lets a rewound viewer finish before showing ended', () => {
    const ended = { ...base, apiStatus: 'ENDED' as const }
    expect(displayState(ended)).toBe('live')
    expect(displayState({ ...ended, videoEnded: true })).toBe('ended')
    expect(displayState({ ...ended, phase: 'idle' })).toBe('ended')
  })

  it('reports errors', () => {
    expect(displayState({ ...base, phase: 'error' })).toBe('error')
  })
})

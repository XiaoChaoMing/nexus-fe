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
    expect(displayState({ ...ended, buffering: true })).toBe('ended')
    expect(displayState({ ...ended, buffering: true, atLiveEdge: false })).toBe('buffering')
  })

  it('reports errors', () => {
    expect(displayState({ ...base, phase: 'error' })).toBe('error')
  })

  it('turns a slow start or a failed session into the error state', () => {
    expect(displayState({ ...base, phase: 'loading', loadingTimedOut: true })).toBe('error')
    expect(displayState({ ...base, phase: 'idle', loadingTimedOut: false })).toBe('loading')
    expect(displayState({ ...base, phase: 'idle', sourceFailed: true })).toBe('error')
    // A late start recovers on its own: once playing, the timeout no longer matters.
    expect(displayState({ ...base, loadingTimedOut: true })).toBe('live')
  })

  it('keeps the 18+ gate above a failed or slow source', () => {
    expect(displayState({ ...base, matureBlocked: true, sourceFailed: true, loadingTimedOut: true })).toBe('mature')
  })

  it('ends a VOD at the end of the video only', () => {
    const vod = { ...base, apiStatus: undefined, vod: true }
    expect(displayState(vod)).toBe('live')
    expect(displayState({ ...vod, videoEnded: true })).toBe('ended')
  })

  it('shows ended over a failed source once the broadcast is over', () => {
    expect(displayState({ ...base, apiStatus: 'ENDED', phase: 'idle', sourceFailed: true })).toBe('ended')
  })
})

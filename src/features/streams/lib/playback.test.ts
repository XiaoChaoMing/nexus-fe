import { describe, expect, it } from 'vitest'
import type { Playback } from '@/features/streams/types'
import { acknowledgesAutomatically, ANON_HEADER, playbackDecision, playbackRequest } from './playback'

const open: Playback = {
  sessionId: 's1',
  manifestUrl: '/hls/streams/1/master.m3u8',
  expiresAt: '2026-10-14T12:00:00Z',
  mature: { required: false, acknowledged: false },
}
const gated: Playback = { sessionId: null, manifestUrl: null, expiresAt: null, anonId: 'a', mature: { required: true, acknowledged: false } }

describe('playback decisions', () => {
  it('plays an open session', () => {
    expect(playbackDecision(open)).toEqual({ kind: 'ready', manifestUrl: open.manifestUrl })
  })

  it('shows the 18+ gate until acknowledged', () => {
    expect(playbackDecision(gated)).toEqual({ kind: 'mature' })
    expect(playbackDecision({ ...open, mature: { required: true, acknowledged: true } }).kind).toBe('ready')
  })

  it('reports a session without a manifest as unavailable', () => {
    expect(playbackDecision({ ...gated, mature: { required: false, acknowledged: false } })).toEqual({ kind: 'unavailable' })
  })

  it('acknowledges automatically only for accounts that opted in', () => {
    expect(acknowledgesAutomatically(true, true)).toBe(true)
    expect(acknowledgesAutomatically(true, false)).toBe(false)
    expect(acknowledgesAutomatically(false, true)).toBe(false)
    expect(acknowledgesAutomatically(true, undefined)).toBe(false)
  })

  it('sends the anon id for guests and the acknowledgement when given', () => {
    const id = () => 'guest-id'
    expect(playbackRequest({ signedIn: false, acknowledge: false, anonId: id })).toEqual({ body: {}, headers: { [ANON_HEADER]: 'guest-id' } })
    expect(playbackRequest({ signedIn: true, acknowledge: true, anonId: id })).toEqual({ body: { acknowledgeMature: true }, headers: {} })
  })
})

import { describe, expect, it } from 'vitest'
import { backoffDelay, BACKOFF_MAX_MS, restartJitter } from './backoff'
import { closeAction, retryAfterFromReason } from './close-codes'
import { encodeFrame, parseServerFrame } from './protocol'
import { realtimeUrl } from './realtime'

describe('parseServerFrame', () => {
  it('reads ready with the heartbeat, defaulting to 25 s', () => {
    expect(parseServerFrame('{"op":"ready","connId":"c1","userId":null,"heartbeatSec":25}')).toEqual({ op: 'ready', connId: 'c1', userId: null, heartbeatSec: 25 })
    expect(parseServerFrame('{"op":"ready","connId":"c1","userId":"u1"}')).toMatchObject({ userId: 'u1', heartbeatSec: 25 })
  })

  it('reads subscribed with its snapshot', () => {
    const f = parseServerFrame(JSON.stringify({ op: 'subscribed', topic: 'chat:s1', seq: 7, snapshot: { room: { status: 'OPEN' } } }))
    expect(f).toEqual({ op: 'subscribed', topic: 'chat:s1', seq: 7, snapshot: { room: { status: 'OPEN' } } })
  })

  it('reads events, with or without seq and topic', () => {
    expect(parseServerFrame('{"op":"event","topic":"chat:s1","seq":3,"type":"message","data":{"id":"m"},"ts":"t"}')).toEqual({
      op: 'event',
      topic: 'chat:s1',
      seq: 3,
      type: 'message',
      data: { id: 'm' },
      ts: 't',
    })
    expect(parseServerFrame('{"op":"event","type":"ack","data":{"clientMsgId":"x","messageId":"m"}}')).toMatchObject({ topic: '', seq: null, type: 'ack' })
  })

  it('merges top-level error fields into details', () => {
    const f = parseServerFrame('{"op":"error","code":"CHAT_SLOW_MODE","message":"slow","ref":"c1","retryAfterSec":8}')
    expect(f).toEqual({ op: 'error', code: 'CHAT_SLOW_MODE', message: 'slow', ref: 'c1', topic: null, details: { retryAfterSec: 8 } })
    const g = parseServerFrame('{"op":"error","code":"CHAT_TIMED_OUT","details":{"until":"2026-10-14T14:30:00Z"}}')
    expect(g).toMatchObject({ ref: null, details: { until: '2026-10-14T14:30:00Z' } })
  })

  it.each(['', 'nope', '[]', '{"op":"hello"}', '{"op":"event","topic":"x"}', '{"op":"subscribed"}', '{"op":"error"}', '{"op":"resync"}'])('drops %s', (raw) => {
    expect(parseServerFrame(raw)).toBeNull()
  })

  it('ignores negative or fractional seq', () => {
    expect(parseServerFrame('{"op":"event","topic":"t","seq":-1,"type":"x"}')).toMatchObject({ seq: null })
    expect(parseServerFrame('{"op":"event","topic":"t","seq":1.5,"type":"x"}')).toMatchObject({ seq: null })
  })

  it('encodes client frames as JSON', () => {
    expect(JSON.parse(encodeFrame({ op: 'auth', token: null, anonId: 'a' }))).toEqual({ op: 'auth', token: null, anonId: 'a' })
  })
})

describe('backoffDelay', () => {
  it('doubles from 1 s up to 30 s', () => {
    const mid = () => 0.5
    expect([0, 1, 2, 3, 4, 5, 6, 20].map((a) => backoffDelay(a, mid))).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000])
  })

  it('stays within ±20 %', () => {
    expect(backoffDelay(0, () => 0)).toBe(800)
    expect(backoffDelay(0, () => 0.999999)).toBe(1200)
    expect(backoffDelay(10, () => 0.999999)).toBeLessThanOrEqual(BACKOFF_MAX_MS * 1.2)
  })

  it('restart jitter is under a second', () => {
    expect(restartJitter(() => 0.5)).toBe(500)
  })
})

describe('closeAction', () => {
  it.each([
    [1012, undefined, { kind: 'restart' }],
    [4001, undefined, { kind: 'reauth' }],
    [4003, undefined, { kind: 'stop' }],
    [4008, undefined, { kind: 'backoff' }],
    [1006, undefined, { kind: 'backoff' }],
    [1000, undefined, { kind: 'backoff' }],
    [4029, 'Retry-After: 12', { kind: 'wait', delayMs: 12_000 }],
    [4029, '', { kind: 'wait', delayMs: 30_000 }],
  ] as const)('%i %s', (code, reason, action) => {
    expect(closeAction(code, reason)).toEqual(action)
  })

  it('reads Retry-After from a reason', () => {
    expect(retryAfterFromReason('retryAfter=5')).toBe(5)
    expect(retryAfterFromReason('7')).toBe(7)
    expect(retryAfterFromReason('too many')).toBeNull()
  })
})

describe('realtimeUrl', () => {
  it('follows the page scheme and host', () => {
    expect(realtimeUrl({ protocol: 'http:', host: 'localhost:5173' })).toBe('ws://localhost:5173/v1/ws')
    expect(realtimeUrl({ protocol: 'https:', host: 'nexuslive.dev' })).toBe('wss://nexuslive.dev/v1/ws')
  })

  it('takes an absolute override', () => {
    expect(realtimeUrl({ protocol: 'http:', host: 'x' }, 'wss://edge/v1/ws')).toBe('wss://edge/v1/ws')
    expect(realtimeUrl({ protocol: 'http:', host: 'x' }, '/v1/ws')).toBe('ws://x/v1/ws')
  })
})

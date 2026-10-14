import { describe, expect, it } from 'vitest'
import { TopicRegistry } from './topics'

describe('TopicRegistry', () => {
  it('counts listeners per topic', () => {
    const r = new TopicRegistry<string>()
    expect(r.add('chat:1', 'a')).toBe(true)
    expect(r.add('chat:1', 'b')).toBe(false)
    expect(r.remove('chat:1', 'a')).toBe(false)
    expect(r.remove('chat:1', 'b')).toBe(true)
    expect(r.has('chat:1')).toBe(false)
    expect(r.remove('chat:1', 'b')).toBe(false)
  })

  it('subscribes fresh, then resumes from the last seq', () => {
    const r = new TopicRegistry<string>()
    r.add('chat:1', 'a')
    expect(r.subscribeFrame('chat:1')).toEqual({ op: 'subscribe', topic: 'chat:1' })
    r.onSubscribed('chat:1', 10, false)
    expect(r.accept('chat:1', 11)).toBe(true)
    expect(r.resubscribeFrames()).toEqual([{ op: 'subscribe', topic: 'chat:1', lastSeq: 11 }])
  })

  it('drops duplicate and older seq, keeps events without seq', () => {
    const r = new TopicRegistry<string>()
    r.add('t', 'a')
    r.onSubscribed('t', 5, false)
    expect(r.accept('t', 5)).toBe(false)
    expect(r.accept('t', 4)).toBe(false)
    expect(r.accept('t', 7)).toBe(true) // gaps are normal (sampling)
    expect(r.accept('t', 6)).toBe(false)
    expect(r.accept('t', null)).toBe(true)
    expect(r.lastSeq('t')).toBe(7)
    expect(r.accept('other', 1)).toBe(false)
  })

  it('keeps lastSeq on resume so replayed events pass', () => {
    const r = new TopicRegistry<string>()
    r.add('t', 'a')
    r.onSubscribed('t', 5, false)
    r.accept('t', 6)
    r.resetActive()
    // The server answers with its head (9) and then replays 7..9.
    r.onSubscribed('t', 9, true)
    expect([7, 8, 9].map((s) => r.accept('t', s))).toEqual([true, true, true])
    expect(r.accept('t', 8)).toBe(false)
  })

  it('forgets the resume point on resync', () => {
    const r = new TopicRegistry<string>()
    r.add('t', 'a')
    r.onSubscribed('t', 5, false)
    r.forgetSeq('t')
    expect(r.subscribeFrame('t')).toEqual({ op: 'subscribe', topic: 't' })
    r.onSubscribed('t', 300, false)
    expect(r.accept('t', 250)).toBe(false)
    expect(r.accept('t', 301)).toBe(true)
  })
})

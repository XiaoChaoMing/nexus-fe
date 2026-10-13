import { describe, expect, it } from 'vitest'
import {
  PENDING_ACTION_KEY,
  PENDING_ACTION_TTL_MS,
  clearPendingAction,
  readPendingAction,
  sanitizeReturnTo,
  savePendingAction,
  takePendingAction,
} from './pending-action'

function memoryStorage() {
  const data = new Map<string, string>()

  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  }
}

describe('sanitizeReturnTo', () => {
  it.each([
    ['/live/abc', '/live/abc'],
    ['/creator/apply?x=1#y', '/creator/apply?x=1#y'],
    ['/', '/'],
  ])('keeps internal path %s', (input, out) => {
    expect(sanitizeReturnTo(input)).toBe(out)
  })

  it.each([
    ['//evil.example'],
    ['/\\evil.example'],
    ['https://evil.example/'],
    ['javascript:alert(1)'],
    ['live/abc'],
    [''],
    ['/\t/evil.example'],
    ['/a\nb'],
    [42],
    [null],
    [undefined],
    ['/' + 'a'.repeat(3000)],
  ])('rejects %j', (input) => {
    expect(sanitizeReturnTo(input)).toBe('/')
    expect(sanitizeReturnTo(input, '/here')).toBe('/here')
  })
})

describe('pending action store', () => {
  it('saves, then take returns it exactly once', () => {
    const s = memoryStorage()
    savePendingAction({ type: 'follow', params: { channelId: 'c1' }, returnTo: '/live/s1' }, s, 1000)

    const first = takePendingAction(s, 2000)
    expect(first).toEqual({ type: 'follow', params: { channelId: 'c1' }, returnTo: '/live/s1', createdAt: 1000 })
    expect(takePendingAction(s, 2000)).toBeNull()
    expect(s.data.has(PENDING_ACTION_KEY)).toBe(false)
  })

  it('read does not consume', () => {
    const s = memoryStorage()
    savePendingAction({ type: 'goLive' }, s, 0)
    expect(readPendingAction(s, 1)?.type).toBe('goLive')
    expect(readPendingAction(s, 1)?.type).toBe('goLive')
  })

  it('sanitizes returnTo when saving and when reading tampered storage', () => {
    const s = memoryStorage()
    expect(savePendingAction({ type: 'navigate', returnTo: '//evil.example' }, s, 0).returnTo).toBe('/')

    s.setItem(PENDING_ACTION_KEY, JSON.stringify({ type: 'navigate', params: { to: '/x', n: 1 }, returnTo: 'https://evil', createdAt: 0 }))
    expect(readPendingAction(s, 1)).toEqual({ type: 'navigate', params: { to: '/x' }, returnTo: '/', createdAt: 0 })
  })

  it('a newer action replaces the older one', () => {
    const s = memoryStorage()
    savePendingAction({ type: 'goLive' }, s, 0)
    savePendingAction({ type: 'follow', params: { channelId: 'c2' } }, s, 1)
    expect(takePendingAction(s, 2)?.type).toBe('follow')
    expect(takePendingAction(s, 2)).toBeNull()
  })

  it('drops stale, unknown or malformed entries (and take still clears them)', () => {
    const s = memoryStorage()
    savePendingAction({ type: 'goLive' }, s, 0)
    expect(takePendingAction(s, PENDING_ACTION_TTL_MS + 1)).toBeNull()
    expect(s.data.size).toBe(0)

    s.setItem(PENDING_ACTION_KEY, JSON.stringify({ type: 'deleteAccount', params: {}, returnTo: '/', createdAt: 0 }))
    expect(takePendingAction(s, 1)).toBeNull()
    expect(s.data.size).toBe(0)

    s.setItem(PENDING_ACTION_KEY, '{not json')
    expect(readPendingAction(s, 1)).toBeNull()
  })

  it('clear removes it; missing or throwing storage is harmless', () => {
    const s = memoryStorage()
    savePendingAction({ type: 'goLive' }, s, 0)
    clearPendingAction(s)
    expect(readPendingAction(s, 1)).toBeNull()

    const broken = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    }
    expect(() => savePendingAction({ type: 'goLive' }, broken)).not.toThrow()
    expect(takePendingAction(broken)).toBeNull()
    expect(takePendingAction(null)).toBeNull()
  })
})

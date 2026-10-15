import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RealtimeClient, type ConnectionStatus, type TopicListener, type WebSocketLike } from './client'

class FakeSocket implements WebSocketLike {
  readyState = 0
  sent: Record<string, unknown>[] = []
  closed: { code?: number; reason?: string } | null = null
  onopen: ((ev: unknown) => void) | null = null
  onmessage: ((ev: { data: unknown }) => void) | null = null
  onclose: ((ev: { code: number; reason: string }) => void) | null = null
  onerror: ((ev: unknown) => void) | null = null
  readonly url: string

  constructor(url: string) {
    this.url = url
  }

  send(data: string) {
    this.sent.push(JSON.parse(data) as Record<string, unknown>)
  }

  close(code?: number, reason?: string) {
    this.closed = { code, reason }
    this.readyState = 3
  }

  // --- test helpers
  open() {
    this.readyState = 1
    this.onopen?.({})
  }

  receive(frame: Record<string, unknown>) {
    this.onmessage?.({ data: JSON.stringify(frame) })
  }

  drop(code = 1006, reason = '') {
    this.readyState = 3
    this.onclose?.({ code, reason })
  }

  ops() {
    return this.sent.map((f) => f.op)
  }
}

let sockets: FakeSocket[]
let token: string | null
let refresh: ReturnType<typeof vi.fn<() => Promise<boolean>>>
let statuses: ConnectionStatus[]

function makeClient(opts: { maxAttempts?: number } = {}) {
  const client = new RealtimeClient({
    url: () => 'ws://test/v1/ws',
    getAuth: () => (token ? { token } : { token: null, anonId: 'anon-1' }),
    refreshAuth: refresh,
    createSocket: (url) => {
      const s = new FakeSocket(url)
      sockets.push(s)

      return s
    },
    random: () => 0.5,
    ...opts,
  })
  client.onStatus((s) => statuses.push(s))

  return client
}

function last(): FakeSocket {
  return sockets[sockets.length - 1]
}

/** Opens the latest socket and answers `ready`. */
function connectReady(userId: string | null = null) {
  last().open()
  last().receive({ op: 'ready', connId: 'c', userId, heartbeatSec: 25 })
}

function listener(): TopicListener & { events: unknown[]; snapshots: unknown[]; resyncs: number; errors: unknown[] } {
  const l = {
    events: [] as unknown[],
    snapshots: [] as unknown[],
    resyncs: 0,
    errors: [] as unknown[],
    onEvent: (e: unknown) => void l.events.push(e),
    onSubscribed: (s: unknown) => void l.snapshots.push(s),
    onResync: () => void (l.resyncs += 1),
    onError: (e: unknown) => void l.errors.push(e),
  }

  return l
}

beforeEach(() => {
  vi.useFakeTimers()
  sockets = []
  token = null
  refresh = vi.fn(async () => false)
  statuses = []
})

afterEach(() => {
  vi.useRealTimers()
})

describe('RealtimeClient', () => {
  it('connects on the first topic, authenticates as a guest with the anon id, then subscribes', () => {
    const c = makeClient()
    const l = listener()
    c.subscribe('chat:s1', l)
    expect(sockets).toHaveLength(1)
    expect(c.status).toBe('connecting')
    last().open()
    expect(last().sent).toEqual([{ op: 'auth', token: null, anonId: 'anon-1' }])
    last().receive({ op: 'ready', connId: 'c', userId: null, heartbeatSec: 25 })
    expect(c.status).toBe('open')
    expect(last().sent[1]).toEqual({ op: 'subscribe', topic: 'chat:s1' })
    last().receive({ op: 'subscribed', topic: 'chat:s1', seq: 4, snapshot: { room: 1 } })
    expect(l.snapshots).toEqual([{ room: 1 }])
  })

  it('sends the access token when signed in', () => {
    token = 'jwt'
    const c = makeClient()
    c.subscribe('stream:s1', listener())
    last().open()
    expect(last().sent[0]).toEqual({ op: 'auth', token: 'jwt' })
  })

  it('delivers events once, in seq order, and routes acks by clientMsgId', () => {
    const c = makeClient()
    const l = listener()
    c.subscribe('chat:s1', l)
    connectReady()
    last().receive({ op: 'subscribed', topic: 'chat:s1', seq: 10 })
    last().receive({ op: 'event', topic: 'chat:s1', seq: 11, type: 'message', data: { id: 'a' } })
    last().receive({ op: 'event', topic: 'chat:s1', seq: 11, type: 'message', data: { id: 'a' } })
    last().receive({ op: 'event', topic: 'chat:s1', seq: 9, type: 'message', data: { id: 'old' } })
    expect(c.send('chat:s1', 'message', { body: 'hi' }, 'cm-1')).toBe(true)
    expect(last().sent.at(-1)).toEqual({ op: 'send', topic: 'chat:s1', type: 'message', data: { body: 'hi' }, clientMsgId: 'cm-1' })
    last().receive({ op: 'event', type: 'ack', data: { clientMsgId: 'cm-1', messageId: 'm1' } })
    expect(l.events.map((e) => (e as { type: string }).type)).toEqual(['message', 'ack'])
    expect((l.events[1] as { topic: string }).topic).toBe('chat:s1')
  })

  it('routes an error with ref to the topic that sent it', () => {
    const c = makeClient()
    const a = listener()
    const b = listener()
    c.subscribe('chat:s1', a)
    c.subscribe('stream:s1', b)
    connectReady()
    last().receive({ op: 'subscribed', topic: 'chat:s1', seq: 1 })
    c.send('chat:s1', 'message', { body: 'x' }, 'cm-2')
    last().receive({ op: 'error', code: 'CHAT_SLOW_MODE', message: '', ref: 'cm-2', details: { retryAfterSec: 5 } })
    expect(a.errors).toHaveLength(1)
    expect(b.errors).toHaveLength(0)
  })

  it('routes a refused subscribe (ref = topic) to that topic only', () => {
    const c = makeClient()
    const a = listener()
    const b = listener()
    c.subscribe('chat:s1', a)
    c.subscribe('user:x', b)
    connectReady()
    last().receive({ op: 'error', code: 'FORBIDDEN', message: '', ref: 'user:x' })
    expect(b.errors).toHaveLength(1)
    expect(a.errors).toHaveLength(0)
  })

  it('refuses to send before the topic is subscribed', () => {
    const c = makeClient()
    c.subscribe('chat:s1', listener())
    expect(c.send('chat:s1', 'message', {}, 'x')).toBe(false)
    connectReady()
    expect(c.send('chat:s1', 'message', {}, 'x')).toBe(false)
  })

  it('reconnects with backoff and resumes from lastSeq', () => {
    const c = makeClient()
    const l = listener()
    c.subscribe('chat:s1', l)
    connectReady()
    last().receive({ op: 'subscribed', topic: 'chat:s1', seq: 5 })
    last().receive({ op: 'event', topic: 'chat:s1', seq: 6, type: 'message', data: {} })
    last().drop()
    expect(c.status).toBe('reconnecting')
    expect(sockets).toHaveLength(1)
    vi.advanceTimersByTime(1000)
    expect(sockets).toHaveLength(2)
    connectReady()
    expect(last().sent[1]).toEqual({ op: 'subscribe', topic: 'chat:s1', lastSeq: 6 })
    last().receive({ op: 'subscribed', topic: 'chat:s1', seq: 8 })
    last().receive({ op: 'event', topic: 'chat:s1', seq: 7, type: 'message', data: {} })
    last().receive({ op: 'event', topic: 'chat:s1', seq: 8, type: 'message', data: {} })
    expect(l.events).toHaveLength(3)
    expect(c.status).toBe('open')
  })

  it('gives up after 5 failed attempts, and retry starts again', () => {
    const c = makeClient()
    c.subscribe('chat:s1', listener())
    const delays = [1000, 2000, 4000, 8000, 16000]
    for (const d of delays) {
      last().drop()
      vi.advanceTimersByTime(d)
    }
    expect(sockets).toHaveLength(6)
    last().drop()
    expect(c.status).toBe('failed')
    vi.advanceTimersByTime(60_000)
    expect(sockets).toHaveLength(6)
    c.retry()
    expect(sockets).toHaveLength(7)
    // NXL-B §7B: FAILED → CONNECTING on "Thử lại".
    expect(c.status).toBe('connecting')
  })

  it('on resync tells the listener and subscribes again without lastSeq', () => {
    const c = makeClient()
    const l = listener()
    c.subscribe('chat:s1', l)
    connectReady()
    last().receive({ op: 'subscribed', topic: 'chat:s1', seq: 5 })
    last().receive({ op: 'resync', topic: 'chat:s1' })
    expect(l.resyncs).toBe(1)
    expect(last().sent.at(-1)).toEqual({ op: 'subscribe', topic: 'chat:s1' })
  })

  it('1012 reconnects right away (with jitter) without counting an attempt', () => {
    const c = makeClient()
    c.subscribe('chat:s1', listener())
    connectReady()
    last().drop(1012)
    vi.advanceTimersByTime(500)
    expect(sockets).toHaveLength(2)
    expect(c.status).toBe('reconnecting')
  })

  it('4003 stops for good', () => {
    const c = makeClient()
    c.subscribe('chat:s1', listener())
    connectReady()
    last().drop(4003)
    vi.advanceTimersByTime(120_000)
    expect(c.status).toBe('forbidden')
    expect(sockets).toHaveLength(1)
  })

  it('after a 4003, another identity (sign-out) connects again', () => {
    const c = makeClient()
    c.subscribe('chat:s1', listener())
    connectReady()
    last().drop(4003)
    expect(c.status).toBe('forbidden')
    c.retry()
    expect(sockets).toHaveLength(1)
    c.reconnect()
    expect(sockets).toHaveLength(2)
    expect(c.status).toBe('connecting')
  })

  it('4029 waits for Retry-After', () => {
    const c = makeClient()
    c.subscribe('chat:s1', listener())
    connectReady()
    last().drop(4029, 'Retry-After: 7')
    vi.advanceTimersByTime(6_999)
    expect(sockets).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(sockets).toHaveLength(2)
    void c
  })

  it('4001 refreshes the token once, then reconnects (as a guest if refresh failed)', async () => {
    token = 'old'
    refresh.mockImplementation(async () => {
      token = null

      return false
    })
    const c = makeClient()
    c.subscribe('chat:s1', listener())
    connectReady('u1')
    last().drop(4001)
    expect(refresh).toHaveBeenCalledTimes(1)
    await vi.runAllTicks()
    await Promise.resolve()
    await Promise.resolve()
    expect(sockets).toHaveLength(2)
    last().open()
    expect(last().sent[0]).toEqual({ op: 'auth', token: null, anonId: 'anon-1' })
    void c
  })

  it('re-authenticates on the open connection when the token is renewed', () => {
    token = 'a'
    const c = makeClient()
    c.subscribe('chat:s1', listener())
    connectReady('u1')
    token = 'b'
    c.reauthenticate()
    expect(last().sent.at(-1)).toEqual({ op: 'auth', token: 'b' })
    c.reauthenticate()
    expect(last().sent.filter((f) => f.op === 'auth')).toHaveLength(2)
  })

  it('sends ping every heartbeat and drops a silent socket', () => {
    const c = makeClient()
    c.subscribe('chat:s1', listener())
    connectReady()
    vi.advanceTimersByTime(25_000)
    expect(last().ops()).toContain('ping')
    vi.advanceTimersByTime(50_000)
    expect(c.status).toBe('reconnecting')
    expect(sockets[0].closed?.code).toBe(4000)
  })

  it('unsubscribes the last listener and closes when idle', () => {
    const c = makeClient()
    const off = c.subscribe('chat:s1', listener())
    connectReady()
    off()
    expect(last().sent.at(-1)).toEqual({ op: 'unsubscribe', topic: 'chat:s1' })
    vi.advanceTimersByTime(10_000)
    expect(last().closed?.code).toBe(1000)
    expect(c.status).toBe('idle')
  })

  it('a second listener on the same topic gets the cached snapshot', async () => {
    const c = makeClient()
    c.subscribe('stream:s1', listener())
    connectReady()
    last().receive({ op: 'subscribed', topic: 'stream:s1', seq: 1, snapshot: { viewerCount: 3 } })
    const late = listener()
    c.subscribe('stream:s1', late)
    await Promise.resolve()
    expect(late.snapshots).toEqual([{ viewerCount: 3 }])
    expect(last().sent.filter((f) => f.op === 'subscribe')).toHaveLength(1)
  })

  it('reports unsupported without WebSocket', () => {
    const c = new RealtimeClient({ url: () => 'x', getAuth: () => ({ token: null }), refreshAuth: async () => false, createSocket: null })
    c.subscribe('chat:s1', listener())
    expect(c.status).toBe('unsupported')
  })

  it('reconnect() opens a fresh connection for another account', () => {
    token = 'a'
    const c = makeClient()
    c.subscribe('chat:s1', listener())
    connectReady('u1')
    last().receive({ op: 'subscribed', topic: 'chat:s1', seq: 3 })
    token = 'b'
    c.reconnect()
    expect(sockets[0].closed?.code).toBe(1000)
    expect(sockets).toHaveLength(2)
    connectReady('u2')
    expect(last().sent).toEqual([
      { op: 'auth', token: 'b' },
      { op: 'subscribe', topic: 'chat:s1', lastSeq: 3 },
    ])
  })
})

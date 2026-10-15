import { backoffDelay, restartJitter } from '@/lib/realtime/backoff'
import { CLOSE, closeAction } from '@/lib/realtime/close-codes'
import { encodeFrame, parseServerFrame, type ClientFrame, type ErrorFrame, type EventFrame, type ServerFrame } from '@/lib/realtime/protocol'
import { TopicRegistry } from '@/lib/realtime/topics'

/**
 * One WebSocket to `/v1/ws` for the whole app (NXL-00 §10): `auth` first, `subscribe` per topic with a resume
 * point, heartbeat, reconnect with backoff and close-code handling. The socket opens when the first topic is
 * wanted and closes a little after the last one is released.
 */

/**
 * ChatConnection (NXL-B §7B) seen from the app: `connecting` (first try), `open`, `reconnecting`, `failed`
 * (gave up after `maxAttempts`, waits for "Thử lại"), `forbidden` (4003, never retried), `unsupported`
 * (no WebSocket in this browser). `idle` = nothing subscribed.
 */
export type ConnectionStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'failed' | 'forbidden' | 'unsupported'

export type SubscribedInfo = { seq: number; resumed: boolean }

export type TopicListener = {
  onSubscribed?: (snapshot: unknown, info: SubscribedInfo) => void
  onEvent?: (event: EventFrame) => void
  /** The resume point is gone: reload over REST (the client subscribes again by itself). */
  onResync?: () => void
  onError?: (error: ErrorFrame) => void
}

export type RealtimeAuth = { token: string | null; anonId?: string }

export type WebSocketLike = {
  readonly readyState: number
  send: (data: string) => void
  close: (code?: number, reason?: string) => void
  onopen: ((ev: unknown) => void) | null
  onmessage: ((ev: { data: unknown }) => void) | null
  onclose: ((ev: { code: number; reason: string }) => void) | null
  onerror: ((ev: unknown) => void) | null
}

type Timers = {
  setTimeout: (fn: () => void, ms: number) => unknown
  clearTimeout: (id: unknown) => void
  setInterval: (fn: () => void, ms: number) => unknown
  clearInterval: (id: unknown) => void
  now: () => number
}

export type RealtimeClientOptions = {
  url: () => string
  getAuth: () => RealtimeAuth
  /** Refreshes the access token; true when a new one was obtained. */
  refreshAuth: () => Promise<boolean>
  /** Null when the browser has no WebSocket. */
  createSocket: ((url: string) => WebSocketLike) | null
  timers?: Timers
  random?: () => number
  /** Failed connection attempts in a row before `failed` (NXL-B §7B: 5). */
  maxAttempts?: number
  /** Keep the socket this long after the last topic is released (page navigation). */
  idleCloseMs?: number
}

const OPEN = 1
/** The server closes after 60 s of silence; we give up on a silent socket a little later. */
const STALE_AFTER_MS = 65_000
/** How long a sent `clientMsgId` is remembered to route its ack/error. */
const REF_TTL_MS = 60_000

const defaultTimers: Timers = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (id) => globalThis.clearTimeout(id as ReturnType<typeof setTimeout>),
  setInterval: (fn, ms) => globalThis.setInterval(fn, ms),
  clearInterval: (id) => globalThis.clearInterval(id as ReturnType<typeof setInterval>),
  now: () => Date.now(),
}

export class RealtimeClient {
  private readonly opts: Required<Omit<RealtimeClientOptions, 'createSocket'>> & Pick<RealtimeClientOptions, 'createSocket'>
  private readonly topics = new TopicRegistry<TopicListener>()
  private readonly statusListeners = new Set<(s: ConnectionStatus) => void>()
  private readonly refs = new Map<string, { topic: string; at: number }>()
  /** Last `subscribed` answer per topic, handed to listeners that join an already subscribed topic. */
  private readonly snapshots = new Map<string, { snapshot: unknown; seq: number }>()
  private socket: WebSocketLike | null = null
  private ready = false
  private attempt = 0
  private reconnectTimer: unknown = null
  private idleTimer: unknown = null
  private heartbeat: unknown = null
  private lastReceivedAt = 0
  private authToken: string | null = null
  private statusValue: ConnectionStatus = 'idle'
  /** A 4001 triggers one token refresh; set again only once a connection got `ready`. */
  private reauthTried = false
  userId: string | null = null

  constructor(opts: RealtimeClientOptions) {
    this.opts = {
      timers: defaultTimers,
      random: Math.random,
      maxAttempts: 5,
      idleCloseMs: 10_000,
      ...opts,
    }
  }

  get status(): ConnectionStatus {
    return this.statusValue
  }

  onStatus(fn: (s: ConnectionStatus) => void): () => void {
    this.statusListeners.add(fn)

    return () => this.statusListeners.delete(fn)
  }

  /** Listens to a topic; the first listener subscribes it. Returns the release function. */
  subscribe(topic: string, listener: TopicListener): () => void {
    this.cancelIdleClose()
    const first = this.topics.add(topic, listener)
    if (first && this.ready) this.write(this.topics.subscribeFrame(topic))
    const known = this.snapshots.get(topic)
    if (!first && known && this.topics.isActive(topic)) {
      // Joining a topic another listener already holds: replay its snapshot, after the caller has returned.
      queueMicrotask(() => {
        if (this.topics.listeners(topic).includes(listener)) listener.onSubscribed?.(known.snapshot, { seq: known.seq, resumed: false })
      })
    }
    this.ensureConnected()

    return () => this.release(topic, listener)
  }

  /** Sends into a topic (chat). False when the frame could not be written (not connected / not subscribed). */
  send(topic: string, type: string, data: unknown, clientMsgId: string): boolean {
    if (!this.ready || !this.topics.isActive(topic)) return false
    this.pruneRefs()
    this.refs.set(clientMsgId, { topic, at: this.opts.timers.now() })

    return this.write({ op: 'send', topic, type, data, clientMsgId })
  }

  /** The access token was renewed for the same account: `auth` again on the open connection (NXL-00 §10.1). */
  reauthenticate() {
    const { token } = this.opts.getAuth()
    if (!this.ready || token === this.authToken) return
    this.authToken = token
    this.write(this.authFrame())
  }

  /** Another account (or sign-out): a fresh connection, topics resumed from their `lastSeq`. */
  reconnect() {
    // A 4003 belongs to the account that was refused (locked): another identity may connect again.
    if (this.statusValue === 'forbidden') {
      this.setStatus('idle')
      this.attempt = 0
      this.ensureConnected()

      return
    }
    if (this.statusValue === 'failed') {
      this.retry()

      return
    }
    if (!this.socket && !this.reconnectTimer) {
      this.ensureConnected()

      return
    }
    this.dropSocket(CLOSE.normal, 'identity changed')
    this.attempt = 0
    this.ensureConnected()
  }

  /** "Thử lại" (failed) or the browser came back online: try now. */
  retry() {
    if (this.statusValue === 'forbidden' || this.statusValue === 'unsupported') return
    if (this.statusValue === 'open' || this.statusValue === 'connecting') return
    this.clearReconnectTimer()
    this.attempt = 0
    this.connect()
  }

  /** Closes everything (tests, sign-out of the app). */
  dispose() {
    this.clearReconnectTimer()
    this.cancelIdleClose()
    this.dropSocket(CLOSE.normal, 'bye')
    this.setStatus('idle')
  }

  // --- connection -------------------------------------------------------------------------------------------

  private ensureConnected() {
    if (this.topics.size === 0 || this.socket || this.reconnectTimer) return
    if (this.statusValue === 'forbidden' || this.statusValue === 'failed') return
    this.connect()
  }

  private connect() {
    if (this.topics.size === 0) return
    if (!this.opts.createSocket) {
      this.setStatus('unsupported')

      return
    }
    this.setStatus(this.attempt === 0 && this.statusValue !== 'reconnecting' ? 'connecting' : 'reconnecting')
    let socket: WebSocketLike
    try {
      socket = this.opts.createSocket(this.opts.url())
    } catch {
      this.scheduleBackoff()

      return
    }
    this.socket = socket
    this.ready = false
    socket.onopen = () => {
      if (this.socket !== socket) return
      const auth = this.opts.getAuth()
      this.authToken = auth.token
      this.write(this.authFrame())
    }
    socket.onmessage = (ev) => {
      if (this.socket !== socket) return
      this.lastReceivedAt = this.opts.timers.now()
      const frame = parseServerFrame(ev.data)
      if (frame) this.handle(frame)
    }
    socket.onclose = (ev) => {
      if (this.socket !== socket) return
      this.handleClose(ev.code, ev.reason)
    }
    socket.onerror = () => {
      // onclose follows; nothing to do here.
    }
  }

  private authFrame(): ClientFrame {
    const auth = this.opts.getAuth()

    return auth.token ? { op: 'auth', token: auth.token } : { op: 'auth', token: null, ...(auth.anonId ? { anonId: auth.anonId } : {}) }
  }

  private handle(frame: ServerFrame) {
    switch (frame.op) {
      case 'ready': {
        const first = !this.ready
        this.ready = true
        this.userId = frame.userId
        if (!first) return // answer to a token renewal
        this.attempt = 0
        this.reauthTried = false
        this.topics.resetActive()
        this.startHeartbeat(frame.heartbeatSec)
        this.setStatus('open')
        for (const f of this.topics.resubscribeFrames()) this.write(f)

        return
      }
      case 'pong':
        return
      case 'subscribed': {
        const resumed = this.topics.lastSeq(frame.topic) !== null && !this.topics.isActive(frame.topic)
        this.topics.onSubscribed(frame.topic, frame.seq, resumed)
        this.snapshots.set(frame.topic, { snapshot: frame.snapshot, seq: frame.seq })
        for (const l of this.topics.listeners(frame.topic)) l.onSubscribed?.(frame.snapshot, { seq: frame.seq, resumed })

        return
      }
      case 'event': {
        const topic = frame.topic || this.topicOfAck(frame)
        if (!topic || !this.topics.accept(topic, frame.seq)) return
        const routed = frame.topic ? frame : { ...frame, topic }
        for (const l of this.topics.listeners(topic)) l.onEvent?.(routed)

        return
      }
      case 'resync': {
        if (!this.topics.has(frame.topic)) return
        this.topics.forgetSeq(frame.topic)
        for (const l of this.topics.listeners(frame.topic)) l.onResync?.()
        this.write({ op: 'subscribe', topic: frame.topic })

        return
      }
      case 'error': {
        // `ref` is a clientMsgId (refused send) or the topic itself (refused subscribe).
        const topic = (frame.ref && (this.refs.get(frame.ref)?.topic ?? (this.topics.has(frame.ref) ? frame.ref : null))) || frame.topic
        if (frame.ref) this.refs.delete(frame.ref)
        const targets = topic ? this.topics.listeners(topic) : this.topics.allListeners()
        for (const l of targets) l.onError?.(frame)
      }
    }
  }

  private topicOfAck(frame: EventFrame): string | null {
    const data = frame.data as { clientMsgId?: unknown } | null
    const id = data && typeof data.clientMsgId === 'string' ? data.clientMsgId : null
    if (!id) return null
    const ref = this.refs.get(id)
    this.refs.delete(id)

    return ref?.topic ?? null
  }

  private handleClose(code: number, reason: string) {
    const wasReady = this.ready
    this.teardownSocket()
    if (this.topics.size === 0) {
      this.setStatus('idle')

      return
    }
    if (wasReady) this.attempt = 0

    const action = closeAction(code, reason)
    switch (action.kind) {
      case 'stop':
        this.setStatus('forbidden')

        return
      case 'restart':
        this.setStatus('reconnecting')
        this.scheduleIn(restartJitter(this.opts.random))

        return
      case 'wait':
        this.setStatus('reconnecting')
        this.scheduleIn(action.delayMs)

        return
      case 'reauth': {
        // A guest cannot be refused a token; and a token refreshed once is not refreshed again in a loop.
        if (!this.authToken || this.reauthTried) {
          this.scheduleBackoff()

          return
        }
        this.setStatus('reconnecting')
        this.reauthTried = true
        this.reconnectTimer = 'reauth'
        void this.opts
          .refreshAuth()
          .catch(() => false)
          .finally(() => {
            if (this.reconnectTimer !== 'reauth') return
            this.reconnectTimer = null
            this.connect()
          })

        return
      }
      case 'backoff':
        this.scheduleBackoff()
    }
  }

  private scheduleBackoff() {
    if (this.attempt >= this.opts.maxAttempts) {
      this.setStatus('failed')

      return
    }
    this.setStatus('reconnecting')
    const delay = backoffDelay(this.attempt, this.opts.random)
    this.attempt += 1
    this.scheduleIn(delay)
  }

  private scheduleIn(ms: number) {
    this.clearReconnectTimer()
    this.reconnectTimer = this.opts.timers.setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, ms)
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer && this.reconnectTimer !== 'reauth') this.opts.timers.clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null
  }

  private startHeartbeat(sec: number) {
    this.stopHeartbeat()
    this.lastReceivedAt = this.opts.timers.now()
    const every = Math.max(1, sec) * 1000
    this.heartbeat = this.opts.timers.setInterval(() => {
      if (this.opts.timers.now() - this.lastReceivedAt > Math.max(STALE_AFTER_MS, every * 2.5)) {
        // Silent socket (half-open TCP): give up on it and reconnect.
        const socket = this.socket
        this.handleClose(4000, 'stale')
        try {
          socket?.close(4000, 'stale')
        } catch {
          // already closed
        }

        return
      }
      this.write({ op: 'ping' })
    }, every)
  }

  private stopHeartbeat() {
    if (this.heartbeat) this.opts.timers.clearInterval(this.heartbeat)
    this.heartbeat = null
  }

  private release(topic: string, listener: TopicListener) {
    const last = this.topics.remove(topic, listener)
    if (!last) return
    this.snapshots.delete(topic)
    if (this.ready) this.write({ op: 'unsubscribe', topic })
    if (this.topics.size === 0) this.scheduleIdleClose()
  }

  private scheduleIdleClose() {
    this.cancelIdleClose()
    this.idleTimer = this.opts.timers.setTimeout(() => {
      this.idleTimer = null
      if (this.topics.size > 0) return
      this.clearReconnectTimer()
      this.dropSocket(CLOSE.normal, 'idle')
      this.attempt = 0
      this.setStatus('idle')
    }, this.opts.idleCloseMs)
  }

  private cancelIdleClose() {
    if (this.idleTimer) this.opts.timers.clearTimeout(this.idleTimer)
    this.idleTimer = null
    // A topic is wanted again after giving up: a new page starts a fresh attempt.
    if (this.statusValue === 'idle' && this.attempt > 0) this.attempt = 0
  }

  /** Closes the socket on purpose: its close event is ignored. */
  private dropSocket(code: number, reason: string) {
    const socket = this.socket
    this.teardownSocket()
    try {
      socket?.close(code, reason)
    } catch {
      // already closed
    }
  }

  private teardownSocket() {
    this.stopHeartbeat()
    if (this.socket) {
      this.socket.onopen = null
      this.socket.onmessage = null
      this.socket.onclose = null
      this.socket.onerror = null
    }
    this.socket = null
    this.ready = false
    this.topics.resetActive()
  }

  private write(frame: ClientFrame): boolean {
    const s = this.socket
    if (!s || s.readyState !== OPEN) return false
    try {
      s.send(encodeFrame(frame))

      return true
    } catch {
      return false
    }
  }

  private pruneRefs() {
    const now = this.opts.timers.now()
    for (const [id, r] of this.refs) if (now - r.at > REF_TTL_MS) this.refs.delete(id)
  }

  private setStatus(s: ConnectionStatus) {
    if (this.statusValue === s) return
    this.statusValue = s
    for (const fn of this.statusListeners) fn(s)
  }
}

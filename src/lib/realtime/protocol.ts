/**
 * Frames of the realtime gateway `/v1/ws` (NXL-00 §10.2, TSD GĐ3 §5.1): one JSON object per frame.
 * Incoming frames are untrusted: `parseServerFrame` checks the shape and drops anything else.
 */

export type ClientFrame =
  | { op: 'auth'; token: string | null; anonId?: string }
  | { op: 'subscribe'; topic: string; lastSeq?: number }
  | { op: 'unsubscribe'; topic: string }
  | { op: 'ping' }
  | { op: 'send'; topic: string; type: string; data: unknown; clientMsgId: string }

export type ReadyFrame = { op: 'ready'; connId: string; userId: string | null; heartbeatSec: number }
export type SubscribedFrame = { op: 'subscribed'; topic: string; seq: number; snapshot?: unknown }
/** `seq` is absent on per-connection events (the `ack` of a sent message); `topic` is '' when the server omits it. */
export type EventFrame = { op: 'event'; topic: string; seq: number | null; type: string; data: unknown; ts: string | null }
export type ResyncFrame = { op: 'resync'; topic: string }
export type ErrorFrame = {
  op: 'error'
  code: string
  message: string
  /** `clientMsgId` of the `send` it answers. */
  ref: string | null
  /** Topic of a refused `subscribe`, when the server says. */
  topic: string | null
  /** `details` of the error envelope (`retryAfterSec`, `until`, `requiredMin`…), top-level fields merged in. */
  details: Record<string, unknown>
}
export type PongFrame = { op: 'pong' }

export type ServerFrame = ReadyFrame | SubscribedFrame | EventFrame | ResyncFrame | ErrorFrame | PongFrame

export const DEFAULT_HEARTBEAT_SEC = 25

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function str(v: unknown): string | null {
  return typeof v === 'string' ? v : null
}

function seqOf(v: unknown): number | null {
  return typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? v : null
}

const ERROR_TOP_LEVEL_DETAILS = ['retryAfterSec', 'until', 'requiredMin', 'followedMin'] as const

/** Parses one text frame; returns null for anything that is not a known, well-formed server frame. */
export function parseServerFrame(raw: unknown): ServerFrame | null {
  if (typeof raw !== 'string') return null
  let v: unknown
  try {
    v = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isRecord(v)) return null

  switch (v.op) {
    case 'ready': {
      const hb = typeof v.heartbeatSec === 'number' && v.heartbeatSec > 0 ? v.heartbeatSec : DEFAULT_HEARTBEAT_SEC

      return { op: 'ready', connId: str(v.connId) ?? '', userId: str(v.userId), heartbeatSec: hb }
    }
    case 'pong':
      return { op: 'pong' }
    case 'subscribed': {
      const topic = str(v.topic)
      if (!topic) return null

      return { op: 'subscribed', topic, seq: seqOf(v.seq) ?? 0, snapshot: v.snapshot }
    }
    case 'event': {
      const type = str(v.type)
      if (!type) return null

      // An `ack` may come without a topic (it answers this connection only); the client routes it by clientMsgId.
      return { op: 'event', topic: str(v.topic) ?? '', type, seq: seqOf(v.seq), data: v.data ?? null, ts: str(v.ts) }
    }
    case 'resync': {
      const topic = str(v.topic)

      return topic ? { op: 'resync', topic } : null
    }
    case 'error': {
      const code = str(v.code)
      if (!code) return null
      const details: Record<string, unknown> = isRecord(v.details) ? { ...v.details } : {}
      for (const k of ERROR_TOP_LEVEL_DETAILS) if (v[k] !== undefined && details[k] === undefined) details[k] = v[k]

      return { op: 'error', code, message: str(v.message) ?? '', ref: str(v.ref), topic: str(v.topic), details }
    }
    default:
      return null
  }
}

export function encodeFrame(frame: ClientFrame): string {
  return JSON.stringify(frame)
}

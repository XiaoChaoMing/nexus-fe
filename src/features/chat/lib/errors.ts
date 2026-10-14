import type { ChatMe, RoomStatus } from '@/features/chat/types'

/**
 * NXL-B §5 / §13 error table → what the chat UI shows. Codes from a refused `send` (WS `error` with `ref`) and
 * `snapshot.me.reason` go through the same mapping.
 */

/** Why the input is closed (BR30: the reason is always written in the input). */
export type ChatLock =
  | { kind: 'followers'; requiredMin: number | null }
  | { kind: 'subs' }
  | { kind: 'timeout'; until: string | null }
  | { kind: 'banned' }
  | { kind: 'emailUnverified' }
  | { kind: 'disabled' }
  | { kind: 'readOnly' }
  | { kind: 'closed' }
  | { kind: 'notOpen' }

/** A short message under the input. `untilMs` makes it count down ("…sau 8 giây"). */
export type InputNotice =
  | { kind: 'slow'; untilMs: number }
  | { kind: 'rateLimited'; untilMs: number }
  | { kind: 'duplicate' }
  | { kind: 'invalid' }
  | { kind: 'contentBlocked' }
  | { kind: 'forbidden' }
  | { kind: 'failed' }

export type ErrorEffect = {
  notice?: InputNotice
  /** Sending is blocked until then (slow mode, rate limit): countdown on the send button. */
  cooldownUntil?: number
  lock?: ChatLock
  /** UNAUTHORIZED: open the login modal (AF10). */
  login?: boolean
}

/** When the server gives no wait for a 429-like refusal. */
const DEFAULT_WAIT_SEC = 5

function numberDetail(details: Record<string, unknown>, key: string): number | null {
  const v = details[key]
  if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return v
  if (typeof v === 'string' && /^\d+(\.\d+)?$/.test(v)) return Number(v)

  return null
}

function stringDetail(details: Record<string, unknown>, key: string): string | null {
  const v = details[key]

  return typeof v === 'string' && v ? v : null
}

export function errorEffect(code: string, details: Record<string, unknown> = {}, now = Date.now()): ErrorEffect {
  const waitMs = () => Math.ceil(numberDetail(details, 'retryAfterSec') ?? DEFAULT_WAIT_SEC) * 1000

  switch (code) {
    case 'CHAT_SLOW_MODE': {
      const until = now + waitMs()

      return { cooldownUntil: until, notice: { kind: 'slow', untilMs: until } }
    }
    case 'RATE_LIMITED': {
      const until = now + waitMs()

      return { cooldownUntil: until, notice: { kind: 'rateLimited', untilMs: until } }
    }
    case 'CHAT_DUPLICATE':
      return { notice: { kind: 'duplicate' } }
    case 'CHAT_FOLLOWERS_ONLY':
      return { lock: { kind: 'followers', requiredMin: numberDetail(details, 'requiredMin') } }
    case 'CHAT_SUBS_ONLY':
      return { lock: { kind: 'subs' } }
    case 'CHAT_TIMED_OUT':
      return { lock: { kind: 'timeout', until: stringDetail(details, 'until') } }
    case 'CHAT_BANNED':
      return { lock: { kind: 'banned' } }
    case 'EMAIL_NOT_VERIFIED':
      return { lock: { kind: 'emailUnverified' } }
    case 'CHAT_READ_ONLY':
      return { lock: { kind: 'readOnly' } }
    case 'CHAT_CLOSED':
    case 'NOT_FOUND':
      return { lock: { kind: 'closed' } }
    case 'CHAT_DISABLED':
      return { lock: { kind: 'disabled' } }
    case 'UNAUTHORIZED':
      return { login: true }
    case 'VALIDATION_FAILED':
      return { notice: { kind: 'invalid' } }
    case 'CHAT_CONTENT_BLOCKED':
      return { notice: { kind: 'contentBlocked' } }
    case 'FORBIDDEN':
      return { notice: { kind: 'forbidden' } }
    default:
      return { notice: { kind: 'failed' } }
  }
}

/** `snapshot.me`: a refusal known before sending (Followers-only, banned, slow mode still running…). */
export function effectFromMe(me: ChatMe | null, now = Date.now()): ErrorEffect {
  if (!me || me.canSend || !me.reason) return {}
  const effect = errorEffect(me.reason, { retryAfterSec: me.retryAfterSec ?? undefined, until: me.until ?? undefined, requiredMin: me.requiredMin ?? undefined }, now)
  // A guest's UNAUTHORIZED is the guest input itself, not a modal popping up on arrival.
  delete effect.login
  // Notices answer something the user did; on arrival only locks and cooldowns apply.
  delete effect.notice

  return effect
}

/** Roles that are never held by Slow mode (BR14, Q3: VIP too). */
export function exemptFromSlow(role: ChatMe['role'] | undefined): boolean {
  return role === 'STREAMER' || role === 'MODERATOR' || role === 'ADMIN' || role === 'VIP'
}

/** Roles that may change the chat modes (§9C, §15). */
export function canManageChat(role: ChatMe['role'] | undefined): boolean {
  return role === 'STREAMER' || role === 'MODERATOR' || role === 'ADMIN'
}

export type ConnectionView = 'connecting' | 'open' | 'reconnecting' | 'failed' | 'unavailable'

/** What the input shows (NXL-B §9B/§9C). */
export type ComposerView =
  | { kind: 'guest' }
  | { kind: 'offline'; reason: 'connecting' | 'reconnecting' | 'failed' | 'unavailable' }
  | { kind: 'locked'; lock: ChatLock }
  | { kind: 'ready'; cooldownSec: number }

export type ComposerInput = {
  signedIn: boolean
  connection: ConnectionView
  roomStatus: RoomStatus | null
  /** The broadcast is over (from the stream itself, even before `room_state` arrives). */
  streamEnded: boolean
  lock: ChatLock | null
  cooldownUntil: number | null
  now: number
}

/** A lock that has run out (timeout reached) no longer applies (AF07: re-enabled without reloading). */
function activeLock(lock: ChatLock | null, now: number): ChatLock | null {
  if (lock?.kind === 'timeout' && lock.until && Date.parse(lock.until) <= now) return null

  return lock
}

export function composerView(i: ComposerInput): ComposerView {
  if (i.streamEnded || i.roomStatus === 'READ_ONLY') return { kind: 'locked', lock: { kind: 'readOnly' } }
  if (i.roomStatus === 'CLOSED') return { kind: 'locked', lock: { kind: 'closed' } }
  if (i.roomStatus === 'NOT_OPEN') return { kind: 'locked', lock: { kind: 'notOpen' } }
  const lock = activeLock(i.lock, i.now)
  if (lock && (lock.kind === 'disabled' || lock.kind === 'readOnly' || lock.kind === 'closed' || lock.kind === 'notOpen')) return { kind: 'locked', lock }
  if (!i.signedIn) return { kind: 'guest' }
  if (i.connection !== 'open') return { kind: 'offline', reason: i.connection }
  if (lock) return { kind: 'locked', lock }
  const left = i.cooldownUntil ? Math.ceil((i.cooldownUntil - i.now) / 1000) : 0

  return { kind: 'ready', cooldownSec: Math.max(0, left) }
}

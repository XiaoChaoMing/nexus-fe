/** What the client does after the socket closes (NXL-00 §10.4). */
export type CloseAction =
  /** Reconnect with backoff (unexpected drop, 4008). */
  | { kind: 'backoff' }
  /** Reconnect soon with a small jitter (1012 service restart). */
  | { kind: 'restart' }
  /** Refresh the access token, then reconnect (as a guest if that fails). */
  | { kind: 'reauth' }
  /** Do not reconnect (4003 forbidden). */
  | { kind: 'stop' }
  /** Reconnect after the server's Retry-After (4029). */
  | { kind: 'wait'; delayMs: number }

export const CLOSE = {
  normal: 1000,
  restart: 1012,
  unauthorized: 4001,
  forbidden: 4003,
  authTimeout: 4008,
  tooMany: 4029,
} as const

/** Used when a 4029 reason carries no number. */
export const DEFAULT_RETRY_AFTER_SEC = 30

/** Reads "Retry-After: 12", "retryAfter=12" or "12" from a close reason; null when absent. */
export function retryAfterFromReason(reason: string | undefined | null): number | null {
  if (!reason) return null
  const m = reason.match(/(\d+(?:\.\d+)?)/)
  if (!m) return null
  const n = Number(m[1])

  return Number.isFinite(n) && n >= 0 ? Math.ceil(n) : null
}

export function closeAction(code: number, reason?: string): CloseAction {
  switch (code) {
    case CLOSE.restart:
      return { kind: 'restart' }
    case CLOSE.unauthorized:
      // The connection's identity changed (sign-in/out raced a renewal): reconnect with the current one.
      return /identity changed/i.test(reason ?? '') ? { kind: 'restart' } : { kind: 'reauth' }
    case CLOSE.forbidden:
      return { kind: 'stop' }
    case CLOSE.tooMany:
      return { kind: 'wait', delayMs: (retryAfterFromReason(reason) ?? DEFAULT_RETRY_AFTER_SEC) * 1000 }
    default:
      // 1000 from the server while topics are still wanted, 1006 (dropped), 4008 (auth too late): try again.
      return { kind: 'backoff' }
  }
}

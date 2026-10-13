/** Error envelope returned by every NexusLive service: `{ error: { code, message, details? } }`. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details: Record<string, unknown>
  /** Seconds to wait before retrying (429): `details.retryAfterSec`, else the `Retry-After` header. */
  readonly retryAfterSec: number | null

  constructor(status: number, code: string, message: string, details: Record<string, unknown> = {}, retryAfterSec: number | null = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
    this.retryAfterSec = retryAfterSec
  }
}

export const NETWORK_ERROR = 'NETWORK_ERROR'

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError
}

/** Code of an error thrown by apiRequest, or '' for anything else. */
export function errorCode(err: unknown): string {
  return isApiError(err) ? err.code : ''
}

/** A string detail of an API error (`details.lockedUntil`, `details.username`…). */
export function detailString(err: unknown, key: string): string | null {
  if (!isApiError(err)) return null
  const v = err.details[key]

  return typeof v === 'string' ? v : null
}

/** Parses `details.retryAfterSec` and the `Retry-After` header (seconds or an HTTP date). */
export function parseRetryAfter(details: Record<string, unknown>, header: string | null, now = Date.now()): number | null {
  const fromDetails = details.retryAfterSec
  if (typeof fromDetails === 'number' && Number.isFinite(fromDetails) && fromDetails >= 0) return Math.ceil(fromDetails)
  if (typeof fromDetails === 'string' && /^\d+$/.test(fromDetails)) return Number(fromDetails)

  if (!header) return null
  if (/^\d+$/.test(header.trim())) return Number(header.trim())

  const at = Date.parse(header)

  return Number.isNaN(at) ? null : Math.max(0, Math.ceil((at - now) / 1000))
}

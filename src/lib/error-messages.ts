import { errorCode, isApiError } from '@/lib/api-error'

/** Codes with a message in `common:errors` (NXL-00 §5). Anything else falls back to a generic message. */
export const KNOWN_ERROR_CODES = [
  'VALIDATION_FAILED',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
  'SERVICE_UNAVAILABLE',
  'NETWORK_ERROR',
  'INVALID_CREDENTIALS',
  'SESSION_EXPIRED',
  'ACCOUNT_LOCKED',
  'EMAIL_NOT_VERIFIED',
  'USERNAME_TAKEN',
  'EMAIL_TAKEN',
  'TOKEN_INVALID',
  'WRONG_PASSWORD',
  'APPLICATION_PENDING',
  'ALREADY_CREATOR',
  'UNDERAGE',
  'INVALID_STATE',
  'NOT_CREATOR',
] as const

export type KnownErrorCode = (typeof KNOWN_ERROR_CODES)[number]
export type ErrorMessageKey = `common:errors.${KnownErrorCode | 'fallback'}`

/** Message key ("common:errors.*") for an API error code; unknown codes get the fallback. */
export function errorKey(code: string): ErrorMessageKey {
  return (KNOWN_ERROR_CODES as readonly string[]).includes(code) ? `common:errors.${code as KnownErrorCode}` : 'common:errors.fallback'
}

/** Message key for any thrown value. */
export function errorKeyOf(err: unknown): ErrorMessageKey {
  return errorKey(errorCode(err))
}

/** Seconds to wait after a 429, defaulting to a minute when the server did not say. */
export function retryAfterOf(err: unknown, fallback = 60): number {
  return isApiError(err) && err.retryAfterSec !== null ? err.retryAfterSec : fallback
}

const TAKEN_VALUES = new Set(['TAKEN', 'USERNAME_TAKEN', 'EMAIL_TAKEN'])

/**
 * Registration fields reported as taken. Accepts the GĐ1 shape (`details.<field> = "TAKEN"`) and the older
 * codes (`USERNAME_TAKEN` / `EMAIL_TAKEN` with or without details).
 */
export function takenFields(err: unknown): Array<'username' | 'email'> {
  if (!isApiError(err)) return []
  const out = new Set<'username' | 'email'>()

  for (const field of ['username', 'email'] as const) {
    const v = err.details[field]
    if (typeof v === 'string' && TAKEN_VALUES.has(v)) out.add(field)
  }
  if (out.size === 0 && err.code === 'USERNAME_TAKEN') out.add('username')
  if (out.size === 0 && err.code === 'EMAIL_TAKEN') out.add('email')

  return [...out]
}

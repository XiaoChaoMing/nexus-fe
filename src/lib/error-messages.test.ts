import { describe, expect, it } from 'vitest'
import { ApiError, detailString, parseRetryAfter } from '@/lib/api-error'
import { errorKey, errorKeyOf, retryAfterOf, takenFields } from '@/lib/error-messages'

describe('errorKey', () => {
  it('maps known codes into common:errors and falls back for the rest', () => {
    for (const code of ['TOKEN_INVALID', 'WRONG_PASSWORD', 'EMAIL_NOT_VERIFIED', 'APPLICATION_PENDING', 'ALREADY_CREATOR', 'UNDERAGE', 'INVALID_STATE', 'NOT_CREATOR', 'RATE_LIMITED', 'FORBIDDEN', 'CONFLICT']) {
      expect(errorKey(code)).toBe(`common:errors.${code}`)
    }
    expect(errorKey('SOMETHING_NEW')).toBe('common:errors.fallback')
    expect(errorKey('')).toBe('common:errors.fallback')
    expect(errorKeyOf(new Error('x'))).toBe('common:errors.fallback')
    expect(errorKeyOf(new ApiError(400, 'TOKEN_INVALID', 'bad'))).toBe('common:errors.TOKEN_INVALID')
  })
})

describe('takenFields', () => {
  it('reads the GĐ1 details shape', () => {
    expect(takenFields(new ApiError(409, 'USERNAME_TAKEN', '', { username: 'TAKEN' }))).toEqual(['username'])
    expect(takenFields(new ApiError(409, 'CONFLICT', '', { username: 'TAKEN', email: 'TAKEN' }))).toEqual(['username', 'email'])
  })

  it('reads the older codes and detail values', () => {
    expect(takenFields(new ApiError(409, 'EMAIL_TAKEN', ''))).toEqual(['email'])
    expect(takenFields(new ApiError(409, 'USERNAME_TAKEN', ''))).toEqual(['username'])
    expect(takenFields(new ApiError(409, 'CONFLICT', '', { email: 'EMAIL_TAKEN' }))).toEqual(['email'])
  })

  it('ignores everything else', () => {
    expect(takenFields(new ApiError(400, 'VALIDATION_FAILED', '', { username: 'FORMAT' }))).toEqual([])
    expect(takenFields(new Error('x'))).toEqual([])
  })
})

describe('retry-after', () => {
  it('prefers details.retryAfterSec, then the header (seconds or date)', () => {
    expect(parseRetryAfter({ retryAfterSec: 42 }, '60')).toBe(42)
    expect(parseRetryAfter({ retryAfterSec: '17' }, null)).toBe(17)
    expect(parseRetryAfter({}, '60')).toBe(60)
    expect(parseRetryAfter({}, new Date(10_000).toUTCString(), 0)).toBe(10)
    expect(parseRetryAfter({}, 'garbage')).toBeNull()
    expect(parseRetryAfter({}, null)).toBeNull()
  })

  it('defaults to a minute when nothing is known', () => {
    expect(retryAfterOf(new ApiError(429, 'RATE_LIMITED', '', {}, 12))).toBe(12)
    expect(retryAfterOf(new ApiError(429, 'RATE_LIMITED', ''))).toBe(60)
    expect(retryAfterOf(new Error('x'))).toBe(60)
  })
})

describe('detailString', () => {
  it('returns string details only', () => {
    const err = new ApiError(403, 'ACCOUNT_LOCKED', '', { lockedUntil: '2026-10-13T10:00:00Z', n: 1 })
    expect(detailString(err, 'lockedUntil')).toBe('2026-10-13T10:00:00Z')
    expect(detailString(err, 'n')).toBeNull()
    expect(detailString(new Error('x'), 'lockedUntil')).toBeNull()
  })
})

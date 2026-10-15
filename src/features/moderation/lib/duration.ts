import { MOD_LIMITS } from '@/features/moderation/types'

/** Timeout presets of Menu/Timeout (TSD S2: 60 / 600 / 3600 s). */
export const TIMEOUT_PRESETS = [
  { sec: 60, label: 'timeout.m1' },
  { sec: 600, label: 'timeout.m10' },
  { sec: 3600, label: 'timeout.h1' },
] as const

export const TIMEOUT_UNITS = ['sec', 'min', 'hour', 'day'] as const
export type TimeoutUnit = (typeof TIMEOUT_UNITS)[number]

const UNIT_SEC: Record<TimeoutUnit, number> = { sec: 1, min: 60, hour: 3600, day: 86_400 }

export type CustomTimeout = { ok: true; sec: number } | { ok: false; error: 'min' | 'max' }

/** Popover/Timeout Custom: a whole positive amount of a unit, at most 14 days. */
export function customTimeout(amount: string, unit: TimeoutUnit): CustomTimeout {
  const n = Number(amount.trim())
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return { ok: false, error: 'min' }
  const sec = n * UNIT_SEC[unit]
  if (sec > MOD_LIMITS.timeoutMaxSec) return { ok: false, error: 'max' }

  return { ok: true, sec }
}

/** The largest whole unit of a duration, for "Đã timeout @x 10 phút". */
export function durationParts(sec: number): { unit: TimeoutUnit; count: number } {
  for (const unit of ['day', 'hour', 'min'] as const) {
    if (sec >= UNIT_SEC[unit] && sec % UNIT_SEC[unit] === 0) return { unit, count: sec / UNIT_SEC[unit] }
  }

  return { unit: 'sec', count: sec }
}

/**
 * Time left as a clock ("9:41", "1:02:05") under a day, else whole days (the caller words it). Never negative.
 */
export function timeLeft(until: string | null, now: number): { clock: string } | { days: number } | null {
  if (!until) return null
  const ms = Date.parse(until) - now
  if (!Number.isFinite(ms)) return null
  const total = Math.max(0, Math.ceil(ms / 1000))
  if (total >= 86_400) return { days: Math.floor(total / 86_400) }
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const ss = String(s).padStart(2, '0')

  return { clock: h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}` }
}

/** Blocked terms: 2–100 characters after trimming and folding spaces (the server normalises further). */
export function termError(term: string): 'length' | null {
  const t = term.trim().replace(/\s+/g, ' ')

  return t.length < MOD_LIMITS.termMin || t.length > MOD_LIMITS.termMax ? 'length' : null
}

/** Usernames typed with or without "@". */
export function cleanUsername(v: string): string {
  return v.trim().replace(/^@+/, '')
}

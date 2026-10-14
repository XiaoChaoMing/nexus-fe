import { formatClock } from '@/features/player/lib/live-edge'
import { currentLocale } from '@/i18n'
import { compactCountIn } from '@/lib/compact-number'
import { languageNameIn, relativeTimeIn } from '@/lib/relative-time'

/** Time since an ISO date as a clock ("1:02:05"), for "Đã phát …". */
export function elapsedSince(iso: string | null, now = Date.now()): string {
  if (!iso) return '0:00'

  return formatClock((now - new Date(iso).getTime()) / 1000)
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return ''

  return new Intl.DateTimeFormat(currentLocale(), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
}

/** Whole days left until an ISO date (never negative). */
export function daysUntil(iso: string, now = Date.now()): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - now) / 86_400_000))
}

/** Locale-aware date/time for the current UI language. */
export function formatDate(iso: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(currentLocale(), options).format(new Date(iso))
}

/** Viewer counts: "1.234", and compact from a million ("1,2 Tr" / "1.2M"). */
export function formatViewers(value: number): string {
  if (value < 1_000_000) return formatNumber(value)

  return new Intl.NumberFormat(currentLocale(), { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(currentLocale()).format(value)
}

/** "2 giờ trước" in the current UI language. */
export function relativeTime(iso: string | null, now = Date.now()): string {
  return relativeTimeIn(currentLocale(), iso, now)
}

/** Display name of a stream language code ("vi" → "Tiếng Việt"). */
export function languageName(code: string): string {
  return languageNameIn(currentLocale(), code)
}

/** Card counts: "1,2K", "12,4K" (GĐ4 design); exact counts use `formatNumber`. */
export function compactCount(value: number): string {
  return compactCountIn(currentLocale(), value)
}

/** "1:24:05" / "48:20" for a duration in seconds. */
export function formatDuration(sec: number): string {
  return formatClock(Math.max(0, sec))
}

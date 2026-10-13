import { formatClock } from '@/features/player/lib/live-edge'
import { currentLocale } from '@/i18n'

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

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(currentLocale()).format(value)
}

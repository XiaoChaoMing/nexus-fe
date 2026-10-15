import { formatDate } from '@/lib/format'

/** "21:30, Thứ Sáu 17/10/2026" in the viewer's time zone. */
export function lockedUntilText(until: string): string {
  return `${formatDate(until, { hour: '2-digit', minute: '2-digit' })}, ${formatDate(until, { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}`
}

import { addDays, dayKey } from '@/lib/timezone'

/** "Hôm nay", "Ngày mai" or a weekday + date heading (04 · Lịch, 18 · Lịch phát), in the viewer's zone. */
export type DayLabel = { kind: 'today' } | { kind: 'tomorrow' } | { kind: 'date'; ms: number }

export function dayLabel(ms: number, now: number, timeZone: string): DayLabel {
  const key = dayKey(ms, timeZone)
  const today = dayKey(now, timeZone)
  if (key === today) return { kind: 'today' }
  if (key === addDays(today, 1)) return { kind: 'tomorrow' }

  return { kind: 'date', ms }
}

export type DayGroup<T> = { key: string; label: DayLabel; items: T[] }

/** Groups items by calendar day in `timeZone`, ascending by time. */
export function groupByDay<T>(items: T[], at: (item: T) => number, now: number, timeZone: string): DayGroup<T>[] {
  const sorted = [...items].sort((a, b) => at(a) - at(b))
  const groups: DayGroup<T>[] = []
  for (const item of sorted) {
    const ms = at(item)
    const key = dayKey(ms, timeZone)
    const last = groups[groups.length - 1]
    if (last && last.key === key) last.items.push(item)
    else groups.push({ key, label: dayLabel(ms, now, timeZone), items: [item] })
  }

  return groups
}

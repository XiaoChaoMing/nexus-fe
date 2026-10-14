import type { Schedule, ScheduleInput } from '@/features/studio/types'
import { addDays, weekdayOf, zonedDateTime, zonedToUtc } from '@/lib/timezone'

/**
 * Studio → Lịch phát form (NXL-G2 §3.4, TSD GĐ4 §6.3). The server takes one-off schedules or a weekly subset of
 * RFC 5545 (`FREQ=WEEKLY;BYDAY=…`, optional `COUNT`/`UNTIL`); this module turns the form into that payload and
 * back, and checks what the server would refuse so the form can say it first.
 */

export const WEEKDAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const
export type Weekday = (typeof WEEKDAYS)[number]

export const SCHEDULE_TITLE_MAX = 140
export const DURATION_MIN = 15
export const DURATION_MAX = 720
export const HORIZON_DAYS = 90
export const SCHEDULE_MAX_ACTIVE = 20

/** Durations offered by the "Thời lượng dự kiến" select (15 phút … 12 giờ). */
export const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120, 150, 180, 240, 300, 360, 480, 600, 720] as const

export type Repeat = 'none' | 'weekly'

export type ScheduleFormValues = {
  title: string
  categoryId: string | null
  /** YYYY-MM-DD in `timezone`. */
  date: string
  /** HH:mm in `timezone`. */
  time: string
  durationMin: number
  repeat: Repeat
  days: Weekday[]
  timezone: string
}

export type ScheduleField = 'title' | 'date' | 'durationMin' | 'days'
export type ScheduleFormError = 'LENGTH' | 'MIN' | 'MAX' | 'REQUIRED'
export type ScheduleFormErrors = Partial<Record<ScheduleField, ScheduleFormError>>

/** Days in the order of the week, without duplicates. */
export function sortDays(days: readonly string[]): Weekday[] {
  return WEEKDAYS.filter((d) => days.includes(d))
}

/** `FREQ=WEEKLY;BYDAY=MO,WE` (+ `COUNT`/`UNTIL` kept from an existing rule) → days; null for anything else. */
export function parseRrule(rrule: string | null | undefined): { days: Weekday[]; count: number | null; until: string | null } | null {
  if (!rrule) return null
  const parts = new Map<string, string>()
  for (const p of rrule.toUpperCase().split(';')) {
    const [k, v] = p.split('=')
    if (k && v !== undefined) parts.set(k.trim(), v.trim())
  }
  if (parts.get('FREQ') !== 'WEEKLY') return null
  const days = sortDays((parts.get('BYDAY') ?? '').split(','))
  if (days.length === 0) return null
  const count = parts.has('COUNT') ? Number(parts.get('COUNT')) : null

  return { days, count: Number.isFinite(count) ? count : null, until: parts.get('UNTIL') ?? null }
}

export function buildRrule(days: readonly Weekday[]): string {
  return `FREQ=WEEKLY;BYDAY=${sortDays(days).join(',')}`
}

/**
 * First date on or after `date` that falls on one of `days`: the server wants the rule's start on a listed
 * weekday, and the form treats "Ngày" as the first day the series may start.
 */
export function firstMatchingDate(date: string, days: readonly Weekday[]): string {
  if (days.length === 0) return date
  for (let i = 0; i < 7; i++) {
    const d = addDays(date, i)
    if (days.includes(WEEKDAYS[weekdayOf(d)] as Weekday)) return d
  }

  return date
}

/** Start instant of the form (UTC ms). */
export function formStart(values: ScheduleFormValues): number {
  const date = values.repeat === 'weekly' ? firstMatchingDate(values.date, values.days) : values.date

  return zonedToUtc(date, values.time, values.timezone)
}

/** Payload of `POST /v1/studio/schedules` / `PUT …/{id}`. `startAt` is RFC 3339 UTC. */
export function toScheduleInput(values: ScheduleFormValues): ScheduleInput {
  return {
    title: values.title.trim(),
    categoryId: values.categoryId,
    startAt: new Date(formStart(values)).toISOString(),
    durationMin: values.durationMin,
    rrule: values.repeat === 'weekly' ? buildRrule(values.days) : null,
    timezone: values.timezone,
  }
}

/** Form values of an existing schedule (edit). */
export function fromSchedule(s: Schedule): ScheduleFormValues {
  const { date, time } = zonedDateTime(Date.parse(s.startAt), s.timezone)
  const rule = parseRrule(s.rrule)

  return {
    title: s.title,
    categoryId: s.category?.id ?? null,
    date,
    time,
    durationMin: s.durationMin,
    repeat: rule ? 'weekly' : 'none',
    days: rule?.days ?? [],
    timezone: s.timezone,
  }
}

/** Empty form: tomorrow at 20:00 (a common evening slot), two hours, no repeat. */
export function emptyScheduleForm(now: number, timezone: string): ScheduleFormValues {
  const today = zonedDateTime(now, timezone)

  return { title: '', categoryId: null, date: addDays(today.date, 1), time: '20:00', durationMin: 120, repeat: 'none', days: [], timezone }
}

/** Errors the server would answer with `VALIDATION_FAILED` (§6.3), keyed by form field. */
export function validateScheduleForm(values: ScheduleFormValues, now = Date.now()): ScheduleFormErrors {
  const errors: ScheduleFormErrors = {}
  const title = values.title.trim()
  if (title.length < 1 || [...title].length > SCHEDULE_TITLE_MAX) errors.title = 'LENGTH'
  if (values.repeat === 'weekly' && values.days.length === 0) errors.days = 'REQUIRED'
  if (!(values.durationMin >= DURATION_MIN && values.durationMin <= DURATION_MAX)) errors.durationMin = 'MIN'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.date) || !/^\d{2}:\d{2}$/.test(values.time)) {
    errors.date = 'REQUIRED'
  } else if (!errors.days) {
    const start = formStart(values)
    if (!(start > now)) errors.date = 'MIN'
    else if (start > now + HORIZON_DAYS * 86_400_000) errors.date = 'MAX'
  }

  return errors
}

/** The next `max` broadcasts of the form ("5 buổi tiếp theo"), as UTC ms. */
export function previewOccurrences(values: ScheduleFormValues, max = 5): number[] {
  if (values.repeat === 'none') return [zonedToUtc(values.date, values.time, values.timezone)]
  if (values.days.length === 0) return []
  const out: number[] = []
  let date = firstMatchingDate(values.date, values.days)
  for (let i = 0; out.length < max && i < 7 * (max + 1); i++) {
    if (values.days.includes(WEEKDAYS[weekdayOf(date)] as Weekday)) out.push(zonedToUtc(date, values.time, values.timezone))
    date = addDays(date, 1)
  }

  return out
}

/** Changing the time or the repeat days removes the reminders of upcoming broadcasts (§6.4): the form warns. */
export function changesTiming(before: ScheduleInput, after: ScheduleInput): boolean {
  return Date.parse(before.startAt) !== Date.parse(after.startAt) || (before.rrule ?? '') !== (after.rrule ?? '') || before.timezone !== after.timezone
}

/** Same as `toScheduleInput` for a saved schedule, to compare edits against. */
export function inputOf(s: Schedule): ScheduleInput {
  return { title: s.title, categoryId: s.category?.id ?? null, startAt: s.startAt, durationMin: s.durationMin, rrule: s.rrule, timezone: s.timezone }
}

/** A schedule still produces broadcasts (ACTIVE and not past its last one). */
export function scheduleState(s: Schedule, now = Date.now()): 'active' | 'ended' | 'cancelled' {
  if (s.status === 'CANCELLED') return 'cancelled'

  return s.nextOccurrences.some((o) => Date.parse(o.occurrenceAt) > now) ? 'active' : 'ended'
}

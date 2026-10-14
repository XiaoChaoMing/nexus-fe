/**
 * Wall-clock time in an IANA time zone without a date library: Intl gives the zone's offset at an instant, and
 * a local time is turned into UTC by correcting a first guess with that offset (twice, for DST edges).
 */

export type ZonedParts = { year: number; month: number; day: number; hour: number; minute: number; second: number; weekday: number }

const formatters = new Map<string, Intl.DateTimeFormat>()

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
    })
    formatters.set(timeZone, f)
  }

  return f
}

const WEEKDAY_INDEX: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }

/** True when the runtime knows the zone. */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    formatter(timeZone)

    return true
  } catch {
    return false
  }
}

/** The browser's zone, else Vietnam (the platform default, NXL-00). */
export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Ho_Chi_Minh'
  } catch {
    return 'Asia/Ho_Chi_Minh'
  }
}

/** Calendar fields of an instant in `timeZone`; `weekday` is 0 = Monday … 6 = Sunday. */
export function zonedParts(ms: number, timeZone: string): ZonedParts {
  const out: Record<string, string> = {}
  for (const p of formatter(timeZone).formatToParts(new Date(ms))) out[p.type] = p.value

  return {
    year: Number(out.year),
    month: Number(out.month),
    day: Number(out.day),
    hour: Number(out.hour),
    minute: Number(out.minute),
    second: Number(out.second),
    weekday: WEEKDAY_INDEX[out.weekday ?? 'Mon'] ?? 0,
  }
}

/** Offset of `timeZone` from UTC at an instant, in minutes (Asia/Ho_Chi_Minh → 420). */
export function zoneOffsetMinutes(ms: number, timeZone: string): number {
  const p = zonedParts(ms, timeZone)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)

  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60_000)
}

/** The instant of a local date + time in `timeZone`. `date` is YYYY-MM-DD, `time` HH:mm. */
export function zonedToUtc(date: string, time: string, timeZone: string): number {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  const guess = Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0)
  let utc = guess - zoneOffsetMinutes(guess, timeZone) * 60_000
  // A second pass settles instants next to an offset change.
  utc = guess - zoneOffsetMinutes(utc, timeZone) * 60_000

  return utc
}

const pad = (n: number) => String(n).padStart(2, '0')

/** "YYYY-MM-DD" and "HH:mm" of an instant in `timeZone` (form fields). */
export function zonedDateTime(ms: number, timeZone: string): { date: string; time: string; weekday: number } {
  const p = zonedParts(ms, timeZone)

  return { date: `${p.year}-${pad(p.month)}-${pad(p.day)}`, time: `${pad(p.hour)}:${pad(p.minute)}`, weekday: p.weekday }
}

/** Calendar day of an instant in `timeZone`, as a sortable key. */
export function dayKey(ms: number, timeZone: string): string {
  return zonedDateTime(ms, timeZone).date
}

/** Adds whole days to a YYYY-MM-DD date. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const t = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + days))

  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}

/** Weekday (0 = Monday) of a YYYY-MM-DD date. */
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split('-').map(Number)

  return (new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay() + 6) % 7
}

/** "GMT+7", "GMT-4:30", "GMT" for the zone at an instant. */
export function gmtLabel(ms: number, timeZone: string): string {
  const off = zoneOffsetMinutes(ms, timeZone)
  if (off === 0) return 'GMT'
  const sign = off > 0 ? '+' : '-'
  const abs = Math.abs(off)
  const h = Math.floor(abs / 60)
  const min = abs % 60

  return `GMT${sign}${h}${min ? `:${pad(min)}` : ''}`
}

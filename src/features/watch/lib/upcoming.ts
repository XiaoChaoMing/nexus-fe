/**
 * "Sắp diễn ra" (NXL-A §7A, 9C; frame 05): the countdown to a scheduled broadcast and which variant the
 * stage shows.
 */

/** Below this the countdown turns cyan (Countdown/Soon). */
export const COUNTDOWN_SOON_MS = 60_000

export type Countdown = { text: string; soon: boolean; done: boolean }

const pad = (n: number) => String(n).padStart(2, '0')

/** "01:24:05" until `targetMs` (hours keep counting past 24: "26:00:00"); "00:00:00" once reached. */
export function countdown(targetMs: number, now: number): Countdown {
  const left = Math.max(0, targetMs - now)
  const total = Math.ceil(left / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60

  return { text: `${pad(h)}:${pad(m)}:${pad(s)}`, soon: left > 0 && left < COUNTDOWN_SOON_MS, done: left === 0 }
}

export type UpcomingPhase =
  /** Counting down; reminders can be set. */
  | 'countdown'
  /** Start time reached, the streamer has not started: "Đang chờ streamer bắt đầu…", no reminder button. */
  | 'waiting'
  | 'cancelled'
  /** Not a scheduled broadcast (any more): the normal live page takes over. */
  | 'none'

export function upcomingPhase(stream: { status: string; scheduledStartAt?: string | null }, now: number): UpcomingPhase {
  if (stream.status === 'CANCELLED') return 'cancelled'
  if (stream.status !== 'SCHEDULED') return 'none'
  const at = stream.scheduledStartAt ? Date.parse(stream.scheduledStartAt) : Number.NaN
  if (!Number.isFinite(at)) return 'waiting'

  return at > now ? 'countdown' : 'waiting'
}

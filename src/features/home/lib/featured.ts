import type { Stream } from '@/features/streams/types'

function startedMs(s: Stream): number {
  const t = s.startedAt ? Date.parse(s.startedAt) : Number.NaN

  return Number.isFinite(t) ? t : -Infinity
}

/**
 * Hero of the home page (WP3): the most recently started broadcast that is live right now; an interrupted one
 * only when nobody is live. Recommendations replace this rule later.
 */
export function featuredStream(items: Stream[] | undefined): Stream | null {
  const list = items ?? []
  const pick = (status: Stream['status']) =>
    list.filter((s) => s.status === status).reduce<Stream | null>((best, s) => (best === null || startedMs(s) > startedMs(best) ? s : best), null)

  return pick('LIVE') ?? pick('INTERRUPTED')
}

/** Whole percent watched, 0–100 ("Đã xem 72%"). */
export function watchedPercent(positionSec: number, durationSec: number): number {
  if (!(durationSec > 0) || !(positionSec > 0)) return 0

  return Math.min(100, Math.max(0, Math.round((positionSec / durationSec) * 100)))
}

/** Thumbnails are rewritten every 30 s under the same key; a per-minute query string beats the cache. */
export function thumbSrc(url: string, now: number): string {
  return `${url}${url.includes('?') ? '&' : '?'}t=${Math.floor(now / 60_000)}`
}

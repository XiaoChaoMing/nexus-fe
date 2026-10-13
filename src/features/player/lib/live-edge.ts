/** Segments are 2 s; three segments behind the live edge still counts as "watching live". */
export const LIVE_EDGE_THRESHOLD_SEC = 6
export const SEEK_STEP_SEC = 10

export function behindLive(liveSyncPosition: number | null, currentTime: number): number {
  if (liveSyncPosition === null || !Number.isFinite(liveSyncPosition)) return 0

  return Math.max(0, liveSyncPosition - currentTime)
}

export function isAtLiveEdge(behindSec: number): boolean {
  return behindSec <= LIVE_EDGE_THRESHOLD_SEC
}

/** 75 → "1:15", 3725 → "1:02:05". */
export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')

  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

/** Player timecode: "03:12" under an hour, "1:24:05" from an hour on (design: "03:12 / 1:24:05"). */
export function formatTimecode(totalSec: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(totalSec) ? totalSec : 0))
  const h = Math.floor(s / 3600)
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const sec = String(s % 60).padStart(2, '0')

  return h > 0 ? `${h}:${m}:${sec}` : `${m}:${sec}`
}

/** Label shown next to the LIVE badge while rewound: "-05:12". */
export function formatBehind(behindSec: number): string {
  return `-${formatTimecode(behindSec)}`
}

/** Keeps a live seek target inside [start, liveSync]: viewers cannot seek past the live edge. */
export function clampLiveSeek(target: number, start: number, liveSync: number | null): number {
  const end = liveSync ?? target

  return Math.min(Math.max(target, start), end)
}

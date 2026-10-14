/** NXL-00 §10.4: 1, 2, 4, 8, 16 s, at most 30 s, each ±20 % at random. */
export const BACKOFF_BASE_MS = 1000
export const BACKOFF_MAX_MS = 30_000
export const BACKOFF_JITTER = 0.2

/** Delay before reconnect attempt `attempt` (0-based). `random` returns [0, 1). */
export function backoffDelay(attempt: number, random: () => number = Math.random): number {
  const step = Math.max(0, Math.floor(attempt))
  const base = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** Math.min(step, 15))
  const jitter = (random() * 2 - 1) * BACKOFF_JITTER

  return Math.round(base * (1 + jitter))
}

/** A small jitter (0–1 s) for "reconnect now" (1012), so a restarted instance is not hit by everyone at once. */
export function restartJitter(random: () => number = Math.random): number {
  return Math.round(random() * BACKOFF_BASE_MS)
}

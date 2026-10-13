import { isApiError } from '@/lib/api-error'
import { MIN_RESUME_SEC, type LocalEntry } from '@/features/vod/lib/progress'

/** Account progress is written at most this often while playing (TSD GĐ2 §3 S2), plus on pause and leave. */
export const SAVE_INTERVAL_MS = 15_000

/**
 * Decides when a playing VOD saves its position: as soon as there is something worth resuming, then every
 * `intervalMs` of wall-clock time. A position equal to the last saved one is never sent twice.
 */
export function createSaveThrottle(intervalMs = SAVE_INTERVAL_MS) {
  let savedAt: number | null = null
  let savedPos: number | null = null

  return {
    /** True when `positionSec` should be saved now. */
    due(positionSec: number, now: number): boolean {
      const pos = Math.floor(positionSec)
      if (pos === savedPos) return false
      if (savedAt === null) return pos >= MIN_RESUME_SEC

      return now - savedAt >= intervalMs
    },
    /** Same position as the last save (nothing new to send on pause/leave). */
    unchanged(positionSec: number): boolean {
      return Math.floor(positionSec) === savedPos
    },
    mark(positionSec: number, now: number) {
      savedAt = now
      savedPos = Math.floor(positionSec)
    },
  }
}

export type SaveThrottle = ReturnType<typeof createSaveThrottle>

/**
 * Pushes this browser's guest positions to the account at sign-in, keeping the further position server-side
 * (`keepFurther`). An entry is cleared once the server took it, or when it can never succeed (VOD gone,
 * position out of range); network failures keep it for the next sign-in. Returns the ids that were cleared.
 */
export async function mergeLocalProgress(
  entries: LocalEntry[],
  put: (vodId: string, positionSec: number) => Promise<unknown>,
  clear: (vodId: string) => void,
): Promise<string[]> {
  const cleared: string[] = []
  for (const e of entries) {
    try {
      await put(e.vodId, e.positionSec)
      clear(e.vodId)
      cleared.push(e.vodId)
    } catch (err) {
      if (isApiError(err) && (err.status === 404 || err.status === 400)) {
        clear(e.vodId)
        cleared.push(e.vodId)
      }
    }
  }

  return cleared
}

/** Resume position per VOD in this browser (UC-A07, local until the account API in GĐ4). */

const KEY_PREFIX = 'nxl.vod.'
/** Below this nothing worth resuming was watched. */
export const MIN_RESUME_SEC = 5
/** This close to the end counts as finished: the next visit starts over. */
export const END_MARGIN_SEC = 10

type Saved = { t: number; d: number; at: number }

export type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function storage(): Store | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/** Saved position in seconds, or null when there is nothing to resume. */
export function loadProgress(vodId: string, store: Store | null = storage()): number | null {
  try {
    const raw = store?.getItem(KEY_PREFIX + vodId)
    if (!raw) return null
    const saved = JSON.parse(raw) as Partial<Saved>
    if (typeof saved.t !== 'number' || !Number.isFinite(saved.t) || saved.t < MIN_RESUME_SEC) return null
    if (typeof saved.d === 'number' && saved.d > 0 && saved.t >= saved.d - END_MARGIN_SEC) return null

    return Math.floor(saved.t)
  } catch {
    return null
  }
}

/** Stores the position; clears it once the viewer reached the end. */
export function saveProgress(vodId: string, time: number, duration: number, store: Store | null = storage(), now = Date.now()) {
  try {
    if (!store || !Number.isFinite(time)) return
    const key = KEY_PREFIX + vodId
    if (duration > 0 && time >= duration - END_MARGIN_SEC) {
      store.removeItem(key)

      return
    }
    if (time < MIN_RESUME_SEC) return
    store.setItem(key, JSON.stringify({ t: Math.floor(time), d: Math.floor(duration), at: now } satisfies Saved))
  } catch {
    // storage full or blocked: resume is a convenience, ignore
  }
}

export function clearProgress(vodId: string, store: Store | null = storage()) {
  try {
    store?.removeItem(KEY_PREFIX + vodId)
  } catch {
    // ignore
  }
}

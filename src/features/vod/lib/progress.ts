/**
 * Resume position per VOD in this browser for guests (UC-A07). Signed-in viewers save to their account
 * (`PUT /v1/me/watch-progress`); local entries are merged up once at sign-in (G2-Q4) and then cleared.
 */

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

/** Whole-second position worth offering "Xem tiếp", or null (barely started, or as good as finished). */
export function resumePosition(positionSec: number | null | undefined, durationSec: number): number | null {
  if (typeof positionSec !== 'number' || !Number.isFinite(positionSec) || positionSec < MIN_RESUME_SEC) return null
  if (durationSec > 0 && positionSec >= durationSec - END_MARGIN_SEC) return null

  return Math.floor(positionSec)
}

/** Saved position in seconds, or null when there is nothing to resume. */
export function loadProgress(vodId: string, store: Store | null = storage()): number | null {
  try {
    const raw = store?.getItem(KEY_PREFIX + vodId)
    if (!raw) return null
    const saved = JSON.parse(raw) as Partial<Saved>

    return resumePosition(saved.t, typeof saved.d === 'number' ? saved.d : 0)
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

export type LocalEntry = { vodId: string; positionSec: number }

type ListableStore = Store & Pick<Storage, 'key' | 'length'>

/** Every resumable position saved in this browser (input of the sign-in merge). */
export function localProgressEntries(store: ListableStore | null = storage() as ListableStore | null): LocalEntry[] {
  const out: LocalEntry[] = []
  try {
    if (!store) return out
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i)
      if (!key?.startsWith(KEY_PREFIX)) continue
      const vodId = key.slice(KEY_PREFIX.length)
      const positionSec = loadProgress(vodId, store)
      if (vodId && positionSec !== null) out.push({ vodId, positionSec })
    }
  } catch {
    // storage blocked: nothing to merge
  }

  return out
}

/** Removes every local position (after the merge, or a finished one). */
export function clearAllProgress(store: ListableStore | null = storage() as ListableStore | null) {
  try {
    if (!store) return
    const keys: string[] = []
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i)
      if (key?.startsWith(KEY_PREFIX)) keys.push(key)
    }
    for (const key of keys) store.removeItem(key)
  } catch {
    // ignore
  }
}

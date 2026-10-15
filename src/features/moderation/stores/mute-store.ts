import { create } from 'zustand'

/**
 * "Ẩn tin người này" (NXL-F, TSD S14): client side only, for this tab — sessionStorage, one list per account
 * (guests share "guest"). Never sent to the server.
 */

export const MUTE_KEY_PREFIX = 'nxl.muted.'

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

function storage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage
  } catch {
    return null
  }
}

export function readMuted(owner: string, s: StorageLike | null = storage()): string[] {
  try {
    const raw = s?.getItem(MUTE_KEY_PREFIX + owner)
    const v: unknown = raw ? JSON.parse(raw) : []

    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function writeMuted(owner: string, ids: readonly string[], s: StorageLike | null = storage()) {
  try {
    s?.setItem(MUTE_KEY_PREFIX + owner, JSON.stringify(ids))
  } catch {
    // Private mode: the list lives in memory for this page only.
  }
}

type MuteState = {
  owner: string | null
  ids: ReadonlySet<string>
  /** Switches to another account's list (sign-in / sign-out). */
  use: (owner: string) => void
  toggle: (userId: string) => boolean
}

export const useMuteStore = create<MuteState>()((set, get) => ({
  owner: null,
  ids: new Set(),
  use: (owner) => {
    if (get().owner === owner) return
    set({ owner, ids: new Set(readMuted(owner)) })
  },
  toggle: (userId) => {
    const { owner, ids } = get()
    const next = new Set(ids)
    const muted = !next.has(userId)
    if (muted) next.add(userId)
    else next.delete(userId)
    set({ ids: next })
    if (owner) writeMuted(owner, [...next])

    return muted
  },
}))

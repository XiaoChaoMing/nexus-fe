/**
 * GĐ1 has no follow API (GĐ4): a follow is remembered in this browser so the intent is not lost, and the
 * real follow can be offered once the feature ships.
 */
const KEY = 'nxl.followIntents'
const MAX = 50

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

function storage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

export function followIntents(s: StorageLike | null = storage()): string[] {
  try {
    const v: unknown = JSON.parse(s?.getItem(KEY) ?? '[]')

    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function recordFollowIntent(channelId: string, s: StorageLike | null = storage()) {
  if (!channelId) return
  const next = [channelId, ...followIntents(s).filter((id) => id !== channelId)].slice(0, MAX)
  try {
    s?.setItem(KEY, JSON.stringify(next))
  } catch {
    // storage blocked: the toast still explains that follow arrives later
  }
}

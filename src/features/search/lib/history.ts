import type { HistoryEntry } from '@/features/search/types'

/**
 * Search history (G4-Q8): accounts keep theirs on the server (≤ 10), guests in this browser. The list helpers are
 * the same for both: newest first, one entry per query regardless of case.
 */
export const HISTORY_MAX = 10
export const GUEST_HISTORY_KEY = 'nxl.searchHistory'

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function storage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

const same = (a: string, b: string) => a.toLocaleLowerCase() === b.toLocaleLowerCase()

/** Puts `query` first (replacing a case-insensitive duplicate) and keeps `max` entries. */
export function pushHistory(list: HistoryEntry[], query: string, now = Date.now(), max = HISTORY_MAX): HistoryEntry[] {
  const q = query.trim()
  if (!q) return list
  const createdAt = new Date(now).toISOString()
  const existing = list.find((e) => same(e.query, q))
  const entry: HistoryEntry = existing ? { ...existing, query: q, createdAt } : { id: `local-${now}-${list.length}`, query: q, createdAt }

  return [entry, ...list.filter((e) => !same(e.query, q))].slice(0, max)
}

export function removeHistory(list: HistoryEntry[], id: string): HistoryEntry[] {
  return list.filter((e) => e.id !== id)
}

/**
 * Server list + guest entries not on the server yet, newest first (used once after sign-in, before the guest
 * entries are uploaded, and while they upload).
 */
export function mergeHistory(server: HistoryEntry[], local: HistoryEntry[], max = HISTORY_MAX): HistoryEntry[] {
  const out: HistoryEntry[] = [...server]
  for (const e of local) if (!out.some((s) => same(s.query, e.query))) out.push(e)

  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, max)
}

function isEntry(v: unknown): v is HistoryEntry {
  if (typeof v !== 'object' || v === null) return false
  const e = v as Record<string, unknown>

  return typeof e.id === 'string' && typeof e.query === 'string' && typeof e.createdAt === 'string'
}

export function readGuestHistory(s: StorageLike | null = storage()): HistoryEntry[] {
  try {
    const v: unknown = JSON.parse(s?.getItem(GUEST_HISTORY_KEY) ?? '[]')

    return Array.isArray(v) ? v.filter(isEntry).slice(0, HISTORY_MAX) : []
  } catch {
    return []
  }
}

export function writeGuestHistory(list: HistoryEntry[], s: StorageLike | null = storage()) {
  try {
    if (list.length === 0) s?.removeItem(GUEST_HISTORY_KEY)
    else s?.setItem(GUEST_HISTORY_KEY, JSON.stringify(list.slice(0, HISTORY_MAX)))
  } catch {
    // storage blocked: the palette still works without history
  }
}

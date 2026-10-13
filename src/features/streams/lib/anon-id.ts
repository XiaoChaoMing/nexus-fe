/**
 * Guest identity for playback sessions (TSD GĐ2 §4, header `X-NXL-Anon-Id`): a random UUID kept in this
 * browser so the server can count one guest across visits. Storage may be blocked; the id then lives for
 * this page only.
 */
export const ANON_ID_KEY = 'nxl.anonId'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

let memoryId: string | null = null

function storage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

export function isAnonId(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value)
}

function randomUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const hex = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16))
  hex[12] = '4'
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16)
  const s = hex.join('')

  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`
}

function read(store: StorageLike | null): string | null {
  try {
    const v = store?.getItem(ANON_ID_KEY)

    return isAnonId(v) ? v : null
  } catch {
    return null
  }
}

/** Remembers an id (one the server handed back, or a fresh one). Invalid values are ignored. */
export function rememberAnonId(id: string, store: StorageLike | null = storage()) {
  if (!isAnonId(id)) return
  memoryId = id
  try {
    store?.setItem(ANON_ID_KEY, id)
  } catch {
    // storage blocked or full: keep it in memory for this page
  }
}

/** The guest id of this browser, created on first use. */
export function anonId(store: StorageLike | null = storage()): string {
  const saved = read(store) ?? (isAnonId(memoryId) ? memoryId : null)
  if (saved) {
    memoryId = saved

    return saved
  }
  const fresh = randomUuid()
  rememberAnonId(fresh, store)

  return fresh
}

/** Test hook: forget the in-memory copy. */
export function resetAnonIdMemory() {
  memoryId = null
}

/**
 * Guest mode (NXL-D §3.2, BR-D10; TSD S5): an action that needs an account is remembered in sessionStorage,
 * the login modal opens, and after a successful sign-in the action runs exactly once.
 */

export const PENDING_ACTION_KEY = 'nxl.pendingAction'

/** Older than this, a remembered action is stale (the guest walked away from the modal). */
export const PENDING_ACTION_TTL_MS = 30 * 60_000

export type PendingActionType =
  /** "Phát trực tiếp": Studio for creators, the Creator application otherwise. */
  | 'goLive'
  /** Creator CTA: the Creator application (or Studio for an existing creator). */
  | 'becomeCreator'
  /** Follow a channel (the follow API ships in GĐ4; GĐ1 only records the intent). */
  | 'follow'
  /** Open a page that needs an account (Following, Profile, session-expired return). */
  | 'navigate'

export type PendingAction = {
  type: PendingActionType
  params: Record<string, string>
  /** Internal path the action belongs to; the user is returned there when it differs from the current page. */
  returnTo: string
  createdAt: number
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const TYPES: readonly PendingActionType[] = ['goLive', 'becomeCreator', 'follow', 'navigate']

function defaultStorage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage
  } catch {
    return null
  }
}

/**
 * Only internal paths: must start with "/" and not "//" (protocol-relative) or "/\" (browsers treat it as "//").
 * Anything else becomes the fallback.
 */
export function sanitizeReturnTo(value: unknown, fallback = '/'): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2048) return fallback
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback
  // Control characters (tabs/newlines are stripped by URL parsers and can turn "/\t/evil" into "//evil").
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i)
    if (c < 0x20 || c === 0x7f) return fallback
  }

  return value
}

export function savePendingAction(
  action: { type: PendingActionType; params?: Record<string, string>; returnTo?: string },
  storage: StorageLike | null = defaultStorage(),
  now = Date.now(),
): PendingAction {
  const stored: PendingAction = {
    type: action.type,
    params: { ...action.params },
    returnTo: sanitizeReturnTo(action.returnTo),
    createdAt: now,
  }
  try {
    storage?.setItem(PENDING_ACTION_KEY, JSON.stringify(stored))
  } catch {
    // Storage full or blocked: the modal still works, the action is just not resumed.
  }

  return stored
}

/** Peeks without consuming (e.g. to show what will happen after sign-in). */
export function readPendingAction(storage: StorageLike | null = defaultStorage(), now = Date.now()): PendingAction | null {
  let raw: string | null = null
  try {
    raw = storage?.getItem(PENDING_ACTION_KEY) ?? null
  } catch {
    return null
  }
  if (!raw) return null

  try {
    const v = JSON.parse(raw) as Partial<PendingAction>
    if (!v || typeof v !== 'object' || !TYPES.includes(v.type as PendingActionType)) return null
    if (typeof v.createdAt !== 'number' || now - v.createdAt > PENDING_ACTION_TTL_MS || v.createdAt > now + 60_000) return null
    const params: Record<string, string> = {}
    if (v.params && typeof v.params === 'object') {
      for (const [k, val] of Object.entries(v.params)) if (typeof val === 'string') params[k] = val
    }

    return { type: v.type as PendingActionType, params, returnTo: sanitizeReturnTo(v.returnTo), createdAt: v.createdAt }
  } catch {
    return null
  }
}

/** Reads and removes the action in one step, so it can only ever run once. */
export function takePendingAction(storage: StorageLike | null = defaultStorage(), now = Date.now()): PendingAction | null {
  const action = readPendingAction(storage, now)
  clearPendingAction(storage)

  return action
}

export function clearPendingAction(storage: StorageLike | null = defaultStorage()) {
  try {
    storage?.removeItem(PENDING_ACTION_KEY)
  } catch {
    // ignore: nothing stored
  }
}

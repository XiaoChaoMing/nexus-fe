/**
 * Channel handles in URLs (NXL-D §9.0, TSD GĐ4 §6.6). Profiles live at `/{handle}` next to the app's own routes,
 * so the server refuses these words as handles; `/c/{handle}` always works as well.
 */
export const RESERVED_HANDLES: ReadonlySet<string> = new Set([
  'login', 'register', 'settings', 'studio', 'admin', 'live', 'vod', 'browse', 'search', 'following', 'creator',
  'c', 'media', 'hls', 'emotes', 'api', 'v1', 'ws', 'help', 'about', 'terms', 'privacy', 'notifications',
  'messages', 'home', 'categories', 'schedule', 'explore', 'nexuslive',
  // Pages of this app that the server list does not name.
  'account', 'dev', 'moderation', 'verify-email', 'forgot-password', 'reset-password', 'session-expired', 'account-locked',
])

/** New handles (BR-D14): 3–25 lower-case letters, digits or "_". */
export const HANDLE_PATTERN = /^[a-z0-9_]{3,25}$/

/**
 * Handles created before GĐ4 may be older shapes (dots, capitals), so the route accepts a little more than a new
 * handle may contain and lets the server answer 404 for the rest.
 */
const ROUTE_HANDLE = /^[A-Za-z0-9_.]{2,30}$/

export function isReservedHandle(handle: string): boolean {
  return RESERVED_HANDLES.has(handle.toLowerCase())
}

/**
 * The handle a `/:handle` segment names, lower-cased; null when the segment cannot be a channel. Under `/c/` a
 * reserved word is still a handle: channels created before the list existed (the dev seed "creator") keep theirs.
 */
export function handleFromSegment(segment: string | undefined, { allowReserved = false } = {}): string | null {
  if (!segment) return null
  let value: string
  try {
    value = decodeURIComponent(segment).replace(/^@/, '')
  } catch {
    return null
  }
  if (!ROUTE_HANDLE.test(value) || (!allowReserved && isReservedHandle(value))) return null

  return value.toLowerCase()
}

/** Canonical link to a profile: `/c/{handle}` when the bare path would hit an app route. */
export function profilePath(handle: string): string {
  return isReservedHandle(handle) || !ROUTE_HANDLE.test(handle) ? `/c/${encodeURIComponent(handle)}` : `/${handle}`
}

/** Field error of a handle typed in Studio → Kênh, matching the server (`handle = FORMAT | INVALID`). */
export function handleError(handle: string): 'FORMAT' | 'INVALID' | null {
  if (!HANDLE_PATTERN.test(handle)) return 'FORMAT'

  return isReservedHandle(handle) ? 'INVALID' : null
}

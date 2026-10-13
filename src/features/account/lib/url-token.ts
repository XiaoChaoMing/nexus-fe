/** `?token=` of a URL search string, trimmed; null when absent or blank. */
export function tokenFromSearch(search: string): string | null {
  return new URLSearchParams(search).get('token')?.trim() || null
}

/** The same path without `token`, or null when there is nothing to remove. */
export function pathWithoutToken(href: string): string | null {
  const url = new URL(href, 'http://localhost')
  if (!url.searchParams.has('token')) return null
  url.searchParams.delete('token')

  return url.pathname + url.search + url.hash
}

/**
 * Removes the one-time token from the address bar (history.replaceState), so it does not stay in history,
 * bookmarks or the Referer of later requests. The router's in-memory location is left alone on purpose.
 */
export function stripTokenFromAddressBar() {
  if (typeof window === 'undefined') return
  const next = pathWithoutToken(window.location.href)
  if (next !== null) window.history.replaceState(window.history.state, '', next)
}

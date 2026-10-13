import { sanitizeReturnTo } from '@/features/auth/lib/pending-action'

/**
 * Where to go after signing in on /login or /register: `?returnTo=` (deep links, NXL-D §3.2) or the page that
 * sent the user there (router state), if it is an internal path.
 */
export function redirectTarget(state: unknown, search = ''): string {
  const fromQuery = new URLSearchParams(search).get('returnTo')
  if (fromQuery) return sanitizeReturnTo(fromQuery)

  return sanitizeReturnTo((state as { from?: unknown } | null)?.from)
}

/** `/login?returnTo=…` for a path, or plain `/login` for the home page. */
export function loginPath(returnTo: string, page: 'login' | 'register' = 'login'): string {
  const safe = sanitizeReturnTo(returnTo)

  return safe === '/' ? `/${page}` : `/${page}?returnTo=${encodeURIComponent(safe)}`
}

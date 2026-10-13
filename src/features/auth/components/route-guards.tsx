import { Navigate, Outlet, useLocation } from 'react-router'
import { loginPath, redirectTarget } from '@/features/auth/lib/redirect'
import { useAuthStore } from '@/features/auth/stores/auth-store'

/** Pages that need an account; remembers where the user was going. */
export function RequireAuth() {
  const status = useAuthStore((s) => s.status)
  const expired = useAuthStore((s) => s.sessionExpired)
  const location = useLocation()
  const here = location.pathname + location.search

  if (status !== 'authenticated') {
    if (expired) return <Navigate to={`/session-expired?returnTo=${encodeURIComponent(here)}`} replace />

    return <Navigate to={loginPath(here)} replace state={{ from: here }} />
  }

  return <Outlet />
}

/** Login and register are pointless once signed in; a successful sign-in also leaves through here. */
export function GuestOnly() {
  const status = useAuthStore((s) => s.status)
  const location = useLocation()

  if (status === 'authenticated') return <Navigate to={redirectTarget(location.state, location.search)} replace />

  return <Outlet />
}

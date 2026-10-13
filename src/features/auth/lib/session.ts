import { configureAuth } from '@/lib/api-client'
import { detailString, errorCode } from '@/lib/api-error'
import { authApi, meApi } from '@/features/auth/api/auth-api'
import { normalizeMe } from '@/features/auth/lib/roles'
import { useAuthStore } from '@/features/auth/stores/auth-store'
import type { Me, Session } from '@/features/auth/types'

let inflight: Promise<boolean> | null = null
let meInflight: Promise<Me | null> | null = null

/** Loads `GET /v1/me` into the store; keeps the session-derived data when it fails. */
export function loadMe(): Promise<Me | null> {
  if (useAuthStore.getState().status !== 'authenticated') return Promise.resolve(null)

  meInflight ??= meApi
    .get()
    .then((raw) => {
      if (useAuthStore.getState().status !== 'authenticated') return null
      if (!raw?.user) throw new Error('empty /v1/me')
      const me = normalizeMe(raw)
      useAuthStore.getState().setMe(me)

      return me
    })
    .catch(() => {
      // Keep the session-derived data, but mark it final so screens waiting for /v1/me can proceed.
      const { status, me } = useAuthStore.getState()
      if (status === 'authenticated' && me) useAuthStore.getState().setMe(me)

      return null
    })
    .finally(() => {
      meInflight = null
    })

  return meInflight
}

/** Stores a fresh session (login, register, password change) and loads the shell data. */
export async function completeSignIn(session: Session): Promise<void> {
  useAuthStore.getState().setSession(session)
  await loadMe()
}

/** Rotates the refresh cookie for a new access token; concurrent callers share one request. */
export function refreshSession(): Promise<boolean> {
  inflight ??= authApi
    .refresh()
    .then(async (session) => {
      await completeSignIn(session)

      return true
    })
    .catch((err: unknown) => {
      const store = useAuthStore.getState()
      if (errorCode(err) === 'ACCOUNT_LOCKED') store.setLocked(detailString(err, 'lockedUntil'))
      // A network failure is not a lost session: keep the user signed in and let the next call retry.
      if (errorCode(err) === 'NETWORK_ERROR' && store.status === 'authenticated') return false
      store.clear({ expired: true })

      return false
    })
    .finally(() => {
      inflight = null
    })

  return inflight
}

/** Wires the HTTP layer to the auth store and restores the session from the refresh cookie. */
export function initAuth(): Promise<boolean> {
  configureAuth({
    getAccessToken: () => useAuthStore.getState().accessToken,
    refresh: refreshSession,
  })

  return refreshSession()
}

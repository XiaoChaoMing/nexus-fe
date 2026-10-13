import { create } from 'zustand'
import type { Me, Session, User } from '@/features/auth/types'
import { meFromUser } from '@/features/auth/lib/roles'

type AuthStatus = 'unknown' | 'authenticated' | 'anonymous'

type AuthState = {
  status: AuthStatus
  user: User | null
  /** Shell data from `GET /v1/me`; derived from `user` until it arrives. */
  me: Me | null
  /** True once `me` came from `GET /v1/me` (not only derived from the session user). */
  meLoaded: boolean
  /** Kept in memory only; never written to localStorage (XSS would expose it). */
  accessToken: string | null
  /** A signed-in session was lost (refresh failed): the UI offers to sign in again. */
  sessionExpired: boolean
  /** The account is locked (403 ACCOUNT_LOCKED on refresh); `until` is null for an indefinite lock. */
  locked: { until: string | null } | null
  setSession: (session: Session) => void
  setMe: (me: Me) => void
  /** Signs out locally. `expired` marks an involuntary loss of the session. */
  clear: (opts?: { expired?: boolean }) => void
  setLocked: (until: string | null) => void
  acknowledgeExpired: () => void
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  status: 'unknown',
  user: null,
  me: null,
  meLoaded: false,
  accessToken: null,
  sessionExpired: false,
  locked: null,
  setSession: (session) => {
    const prev = get().me
    // Keep the richer /v1/me data of the same account while a new token arrives.
    const same = prev !== null && prev.user.id === session.user.id
    const me = same ? { ...prev, user: { ...prev.user, ...session.user } } : meFromUser(session.user)
    set({ status: 'authenticated', user: me.user, accessToken: session.accessToken, me, meLoaded: same && get().meLoaded, sessionExpired: false, locked: null })
  },
  setMe: (me) => set({ me, user: me.user, meLoaded: true }),
  clear: (opts) =>
    set((s) => ({
      status: 'anonymous',
      user: null,
      me: null,
      meLoaded: false,
      accessToken: null,
      sessionExpired: Boolean(opts?.expired && s.status === 'authenticated'),
    })),
  setLocked: (until) => set({ locked: { until } }),
  acknowledgeExpired: () => set({ sessionExpired: false }),
}))

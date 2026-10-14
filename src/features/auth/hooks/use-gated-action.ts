import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { savePendingAction, type PendingActionType } from '@/features/auth/lib/pending-action'
import { runAction } from '@/features/auth/lib/run-action'
import { useAuthModal, type AuthContext, type AuthTab } from '@/features/auth/stores/auth-modal-store'
import { useAuthStore } from '@/features/auth/stores/auth-store'

export type GatedAction = {
  type: PendingActionType
  params?: Record<string, string>
  /** Defaults to the current page. */
  returnTo?: string
  /** Tab the modal opens on for guests. */
  tab?: AuthTab
  /** Context line of the modal. */
  context?: AuthContext
}

/**
 * Runs an action that needs an account: immediately when signed in, otherwise remembers it and opens the
 * login modal; the pending-action runner finishes it once after sign-in.
 */
export function useGatedAction() {
  const navigate = useNavigate()
  const location = useLocation()
  const signedIn = useAuthStore((s) => s.status === 'authenticated')
  const me = useAuthStore((s) => s.me)
  const show = useAuthModal((s) => s.show)
  const currentPath = location.pathname + location.search

  return useCallback(
    (action: GatedAction) => {
      const full = { type: action.type, params: action.params ?? {}, returnTo: action.returnTo ?? currentPath }
      if (signedIn) {
        runAction(full, { me, currentPath, navigate })

        return
      }
      savePendingAction(full)
      show(action.tab ?? 'login', action.context ?? null)
    },
    [signedIn, me, currentPath, navigate, show],
  )
}

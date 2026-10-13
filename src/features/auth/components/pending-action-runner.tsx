import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { takePendingAction } from '@/features/auth/lib/pending-action'
import { runAction } from '@/features/auth/lib/run-action'
import { useAuthStore } from '@/features/auth/stores/auth-store'

/** Runs the action a guest started before signing in, once: `takePendingAction` removes it as it reads it. */
export function PendingActionRunner() {
  const status = useAuthStore((s) => s.status)
  const me = useAuthStore((s) => s.me)
  const meLoaded = useAuthStore((s) => s.meLoaded)
  const navigate = useNavigate()
  const location = useLocation()
  const currentPath = location.pathname + location.search

  useEffect(() => {
    if (status !== 'authenticated' || !me || !meLoaded) return
    const action = takePendingAction()
    if (action) runAction(action, { me, currentPath, navigate })
    // Only a sign-in (status/account change) triggers the runner, not every navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, me?.user.id, meLoaded])

  return null
}

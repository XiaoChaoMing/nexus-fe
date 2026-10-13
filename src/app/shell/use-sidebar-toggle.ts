import { useCallback } from 'react'
import { meApi } from '@/features/auth/api/auth-api'
import { normalizeMe } from '@/features/auth/lib/roles'
import { useAuthStore } from '@/features/auth/stores/auth-store'
import { useUiStore } from '@/stores/ui-store'

/** Flips the sidebar; a signed-in user's choice is saved to the account (`preferences.sidebarCollapsed`). */
export function useSidebarToggle() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed)
  const setCollapsed = useUiStore((s) => s.setSidebarCollapsed)

  const toggle = useCallback(() => {
    const next = !useUiStore.getState().sidebarCollapsed
    setCollapsed(next)
    if (useAuthStore.getState().status !== 'authenticated') return
    meApi
      .update({ preferences: { sidebarCollapsed: next } })
      .then((raw) => {
        if (raw?.user && useAuthStore.getState().status === 'authenticated') useAuthStore.getState().setMe(normalizeMe(raw))
      })
      .catch(() => {
        // The local choice stays; it is saved again on the next toggle.
      })
  }, [setCollapsed])

  return { collapsed, toggle }
}

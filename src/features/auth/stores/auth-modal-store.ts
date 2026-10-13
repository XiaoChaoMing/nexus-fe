import { create } from 'zustand'
import { clearPendingAction } from '@/features/auth/lib/pending-action'

export type AuthTab = 'login' | 'register'

type AuthModalState = {
  open: boolean
  tab: AuthTab
  show: (tab?: AuthTab) => void
  setTab: (tab: AuthTab) => void
  /**
   * Closes the modal. Dismissing it drops the remembered action; after a successful sign-in the action is
   * kept for the runner (`signedIn`).
   */
  close: (opts?: { signedIn?: boolean }) => void
}

export const useAuthModal = create<AuthModalState>()((set) => ({
  open: false,
  tab: 'login',
  show: (tab = 'login') => set({ open: true, tab }),
  setTab: (tab) => set({ tab }),
  close: (opts) => {
    if (!opts?.signedIn) clearPendingAction()
    set({ open: false })
  },
}))

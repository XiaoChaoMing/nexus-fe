import { create } from 'zustand'
import { clearPendingAction } from '@/features/auth/lib/pending-action'

export type AuthTab = 'login' | 'register'

/** Why the modal opened (frames 04/05: "Đăng nhập để theo dõi kênh" / "Đăng nhập để đặt nhắc"). */
export type AuthContext = 'follow' | 'remind'

type AuthModalState = {
  open: boolean
  tab: AuthTab
  context: AuthContext | null
  show: (tab?: AuthTab, context?: AuthContext | null) => void
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
  context: null,
  show: (tab = 'login', context = null) => set({ open: true, tab, context }),
  setTab: (tab) => set({ tab }),
  close: (opts) => {
    if (!opts?.signedIn) clearPendingAction()
    set({ open: false })
  },
}))

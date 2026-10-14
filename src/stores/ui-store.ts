import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type UiState = {
  sidebarCollapsed: boolean
  /** Theater mode of a player page: the sidebar shrinks to icons while it lasts (not persisted). */
  theater: boolean
  setTheater: (on: boolean) => void
  /** Bumped to ask the live page to show and focus the chat input (after a guest signs in to chat, AF10). */
  chatFocusRequest: number
  requestChatFocus: () => void
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
}

/** NXL-C BR32: tablets start collapsed, desktops expanded, until the user chooses. */
function defaultCollapsed(): boolean {
  return typeof window !== 'undefined' && window.innerWidth < 1280
}

// The collapsed state survives reloads (PRD FR-SH-02). Guests keep it here only; signed-in users also save it
// to their account (`preferences.sidebarCollapsed`, see useSidebarToggle).
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: defaultCollapsed(),
      theater: false,
      setTheater: (theater) => set({ theater }),
      chatFocusRequest: 0,
      requestChatFocus: () => set((s) => ({ chatFocusRequest: s.chatFocusRequest + 1 })),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
    }),
    { name: 'nxl-ui', partialize: (s) => ({ sidebarCollapsed: s.sidebarCollapsed }) },
  ),
)

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type UiState = {
  sidebarCollapsed: boolean
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
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
    }),
    { name: 'nxl-ui' },
  ),
)

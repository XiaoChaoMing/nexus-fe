import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet } from 'react-router'
import { BottomNav } from '@/app/shell/bottom-nav'
import { Sidebar } from '@/app/shell/sidebar'
import { TopBar } from '@/app/shell/top-bar'
import { EmailVerifyBanner } from '@/features/account/components/email-verify-banner'
import { AuthModal } from '@/features/auth/components/auth-modal'
import { PendingActionRunner } from '@/features/auth/components/pending-action-runner'
import { useAuthStore } from '@/features/auth/stores/auth-store'
import { OfflineBanner } from '@/features/system/components/offline-banner'
import { SessionWatcher } from '@/features/system/components/session-watcher'
import { useUiStore } from '@/stores/ui-store'

/** The account's saved sidebar choice wins over this browser's when an account signs in. */
function useAccountSidebarPreference() {
  const userId = useAuthStore((s) => (s.meLoaded ? s.me?.user.id : undefined))
  const saved = useAuthStore((s) => s.me?.preferences.sidebarCollapsed)
  const setCollapsed = useUiStore((s) => s.setSidebarCollapsed)

  useEffect(() => {
    if (userId && saved !== undefined) setCollapsed(saved)
    // Only on account change: later toggles are local first and saved by useSidebarToggle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])
}

export function AppShell() {
  const { t } = useTranslation()
  useAccountSidebarPreference()

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-control focus:bg-card focus:px-3 focus:py-2">
        {t('nav.skipToContent')}
      </a>
      <OfflineBanner />
      <TopBar />
      <EmailVerifyBanner />
      <div className="flex flex-1">
        <Sidebar />
        <main id="main" className="min-w-0 flex-1 pb-14 md:pb-0">
          <Outlet />
        </main>
      </div>
      <BottomNav />
      <AuthModal />
      <PendingActionRunner />
      <SessionWatcher />
    </div>
  )
}

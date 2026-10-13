import { createBrowserRouter, Navigate } from 'react-router'
import { AppShell } from '@/app/app-shell'
import { HomePage } from '@/app/home-page'
import { ForgotPasswordPage } from '@/features/account/components/forgot-password-page'
import { ResetPasswordPage } from '@/features/account/components/reset-password-page'
import { SettingsAccountPage } from '@/features/account/components/settings-account-page'
import { VerifyEmailPage } from '@/features/account/components/verify-email-page'
import { LoginPage } from '@/features/auth/components/login-page'
import { RegisterPage } from '@/features/auth/components/register-page'
import { GuestOnly, RequireAuth } from '@/features/auth/components/route-guards'
import { CreatorApplyPage } from '@/features/creator/components/creator-apply-page'
import { BrowsePage, FollowingPage, SearchPage } from '@/features/discover/discover-pages'
import { AccountLockedPage, NotFoundPage, ServerErrorPage, SessionExpiredPage } from '@/features/system/pages/system-pages'

// No admin routes here: administration is the separate nexuslive-admin app (VITE_ADMIN_URL).
export const router = createBrowserRouter([
  {
    errorElement: <ServerErrorPage />,
    children: [
      {
        element: <GuestOnly />,
        children: [
          { path: '/login', element: <LoginPage /> },
          { path: '/register', element: <RegisterPage /> },
        ],
      },
      // Token links from emails: usable signed in or not.
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/reset-password', element: <ResetPasswordPage /> },
      {
        element: <AppShell />,
        // Lazy player routes: shown while their chunk loads on a direct visit.
        hydrateFallbackElement: <div className="min-h-dvh bg-deep" />,
        children: [
          { path: '/', element: <HomePage /> },
          { path: '/browse', element: <BrowsePage /> },
          { path: '/following', element: <FollowingPage /> },
          { path: '/search', element: <SearchPage /> },
          { path: '/verify-email', element: <VerifyEmailPage /> },
          { path: '/session-expired', element: <SessionExpiredPage /> },
          { path: '/account-locked', element: <AccountLockedPage /> },
          // Pages with the player load hls.js (~500 kB) only when opened.
          // Design-system reference, dev builds only.
          ...(import.meta.env.DEV
            ? [{ path: '/dev/ui', lazy: async () => ({ Component: (await import('@/features/design-system/ui-gallery-page')).UiGalleryPage }) }]
            : []),
          { path: '/live/:streamId', lazy: async () => ({ Component: (await import('@/features/watch/live-page')).LivePage }) },
          { path: '/vod/:vodId', lazy: async () => ({ Component: (await import('@/features/vod/vod-page')).VodPage }) },
          {
            element: <RequireAuth />,
            children: [
              { path: '/account', element: <Navigate to="/settings/account" replace /> },
              { path: '/settings/account', element: <SettingsAccountPage /> },
              { path: '/creator/apply', element: <CreatorApplyPage /> },
              { path: '/studio/stream', lazy: async () => ({ Component: (await import('@/features/studio/stream-page')).StudioStreamPage }) },
            ],
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
])

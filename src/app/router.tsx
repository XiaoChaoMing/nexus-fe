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
import { ProfilePage } from '@/features/channels/profile-page'
import { BrowsePage } from '@/features/discover/browse-page'
import { CategoryPage } from '@/features/discover/category-page'
import { FollowingPage } from '@/features/discover/following-page'
import { SearchPage } from '@/features/search/search-page'
import { ModerationPage } from '@/features/moderation/pages/moderation-page'
import { PrivacySettingsPage } from '@/features/moderation/pages/privacy-page'
import { NotificationSettingsPage } from '@/features/notifications/notification-settings-page'
import { NotificationsPage } from '@/features/notifications/notifications-page'
import { UnsubscribePage } from '@/features/notifications/unsubscribe-page'
import { SettingsLayout } from '@/features/settings/settings-layout'
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
      // E-mail unsubscribe link (NXL-E): no account needed, no app frame (frame 25).
      { path: '/notifications/unsubscribe', element: <UnsubscribePage /> },
      {
        element: <AppShell />,
        // Lazy player routes: shown while their chunk loads on a direct visit.
        hydrateFallbackElement: <div className="min-h-dvh bg-background" />,
        children: [
          { path: '/', element: <HomePage /> },
          { path: '/browse', element: <BrowsePage /> },
          { path: '/browse/:slug', element: <CategoryPage /> },
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
              {
                path: '/settings',
                element: <SettingsLayout />,
                children: [
                  { index: true, element: <Navigate to="/settings/account" replace /> },
                  { path: 'account', element: <SettingsAccountPage /> },
                  { path: 'notifications', element: <NotificationSettingsPage /> },
                  { path: 'privacy', element: <PrivacySettingsPage /> },
                ],
              },
              { path: '/notifications', element: <NotificationsPage /> },
              { path: '/moderation/:channel', element: <ModerationPage /> },
              { path: '/creator/apply', element: <CreatorApplyPage /> },
              {
                path: '/studio',
                lazy: async () => ({ Component: (await import('@/features/studio/studio-layout')).StudioLayout }),
                children: [
                  { index: true, lazy: async () => ({ Component: (await import('@/features/studio/dashboard-page')).StudioDashboardPage }) },
                  { path: 'stream', lazy: async () => ({ Component: (await import('@/features/studio/stream-page')).StudioStreamPage }) },
                  { path: 'content', lazy: async () => ({ Component: (await import('@/features/studio/content-page')).StudioContentPage }) },
                  { path: 'schedule', lazy: async () => ({ Component: (await import('@/features/studio/schedule-page')).StudioSchedulePage }) },
                  { path: 'channel', lazy: async () => ({ Component: (await import('@/features/studio/channel-page')).StudioChannelPage }) },
                  { path: 'community', lazy: async () => ({ Component: (await import('@/features/studio/community-page')).StudioCommunityPage }) },
                  // Older links (notification-svc NEW_FOLLOWER) name the overview "dashboard".
                  { path: 'dashboard', element: <Navigate to="/studio" replace /> },
                ],
              },
            ],
          },
          // Channel profiles (NXL-D §9.0): every app route above wins over a handle; `/c/` works for any handle.
          { path: '/c/:handle', element: <ProfilePage /> },
          { path: '/:handle', element: <ProfilePage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
])

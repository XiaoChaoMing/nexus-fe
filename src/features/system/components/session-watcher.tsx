import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useAuthModal } from '@/features/auth/stores/auth-modal-store'
import { useAuthStore } from '@/features/auth/stores/auth-store'
import { useRealtimeStatus } from '@/lib/realtime'

/**
 * Reacts to session changes made outside React: a lost session (refresh failed) becomes a toast with a sign-in
 * button while the page keeps working (NXL-A E12); a lock found on refresh opens the locked page.
 */
export function SessionWatcher() {
  const { t } = useTranslation('system')
  const expired = useAuthStore((s) => s.sessionExpired)
  const locked = useAuthStore((s) => s.locked)
  const show = useAuthModal((s) => s.show)
  const navigate = useNavigate()

  useEffect(() => {
    if (!expired) return
    toast.warning(t('sessionExpired.toast'), {
      id: 'session-expired',
      duration: 10_000,
      action: { label: t('sessionExpired.login'), onClick: () => show('login') },
    })
  }, [expired, show, t])

  // 4003 on the realtime socket: the account was locked while signed in (TSD GĐ5 §5.8). The live page keeps
  // playing and shows it in the chat (design 03f); anywhere else the locked page opens.
  const realtimeStatus = useRealtimeStatus()
  const signedIn = useAuthStore((s) => s.status === 'authenticated')
  const { pathname } = useLocation()
  useEffect(() => {
    if (realtimeStatus !== 'forbidden' || !signedIn) return
    if (pathname.startsWith('/live/') || pathname === '/account-locked') return
    navigate('/account-locked', { replace: true })
  }, [realtimeStatus, signedIn, pathname, navigate])

  useEffect(() => {
    if (!locked) return
    navigate(locked.until ? `/account-locked?until=${encodeURIComponent(locked.until)}` : '/account-locked', { replace: true })
  }, [locked, navigate])

  return null
}

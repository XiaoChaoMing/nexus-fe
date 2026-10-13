import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useAuthModal } from '@/features/auth/stores/auth-modal-store'
import { useAuthStore } from '@/features/auth/stores/auth-store'

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

  useEffect(() => {
    if (!locked) return
    navigate(locked.until ? `/account-locked?until=${encodeURIComponent(locked.until)}` : '/account-locked', { replace: true })
  }, [locked, navigate])

  return null
}

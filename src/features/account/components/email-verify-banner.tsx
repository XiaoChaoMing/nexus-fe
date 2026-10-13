import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MailWarningIcon } from 'lucide-react'
import { Banner, BannerAction } from '@/components/ui/banner'
import { useResendVerification } from '@/features/account/hooks/use-resend-verification'
import { useAuthStore } from '@/features/auth/stores/auth-store'

const DISMISS_KEY = 'nxl.verifyBanner.dismissed'

function dismissedInSession(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

/** Thin banner under the top bar while the email is unverified (NXL-D §3.1, §9); closable for the session. */
export function EmailVerifyBanner() {
  const { t } = useTranslation('account')
  const user = useAuthStore((s) => s.user)
  const [dismissed, setDismissed] = useState(dismissedInSession)
  const { resend, isPending, lockedFor } = useResendVerification()

  if (!user || user.emailVerified || dismissed) return null

  const dismiss = () => {
    setDismissed(true)
    try {
      sessionStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // closed for this render only
    }
  }

  return (
    <Banner
      role="status"
      data-testid="verify-banner"
      variant="info"
      icon={<MailWarningIcon aria-hidden />}
      action={
        <BannerAction onClick={resend} disabled={isPending || lockedFor > 0} aria-busy={isPending || undefined}>
          {lockedFor > 0 ? t('verifyBanner.resendIn', { count: lockedFor }) : t('verifyBanner.resend')}
        </BannerAction>
      }
      onDismiss={dismiss}
      dismissLabel={t('verifyBanner.dismiss')}
    >
      {t('verifyBanner.text', { email: user.email })}
    </Banner>
  )
}

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MailWarningIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
    <div role="status" data-testid="verify-banner" className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-warning/40 bg-warning/10 px-4 py-2 text-body-sm">
      <MailWarningIcon className="size-4 shrink-0 text-warning" aria-hidden />
      <span className="min-w-0 flex-1">{t('verifyBanner.text', { email: user.email })}</span>
      <Button size="sm" variant="secondary" onClick={resend} loading={isPending} disabled={lockedFor > 0}>
        {lockedFor > 0 ? t('verifyBanner.resendIn', { count: lockedFor }) : t('verifyBanner.resend')}
      </Button>
      <Button size="icon-sm" variant="ghost" onClick={dismiss} aria-label={t('verifyBanner.dismiss')}>
        <XIcon />
      </Button>
    </div>
  )
}

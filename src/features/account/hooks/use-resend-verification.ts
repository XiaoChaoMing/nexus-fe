import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useMessage } from '@/i18n/messages'
import { errorCode } from '@/lib/api-error'
import { errorKeyOf, retryAfterOf } from '@/lib/error-messages'
import { authApi } from '@/features/auth/api/auth-api'
import { loadMe } from '@/features/auth/lib/session'

/** Default wait after a successful send (identity allows one email per 60 s, TSD §5). */
const RESEND_COOLDOWN_SEC = 60

/** AF-D02 "Gửi lại": 202 → sent; 409 → already verified (refresh the account); 429 → wait, button locked. */
export function useResendVerification() {
  const { t } = useTranslation('account')
  const msg = useMessage()
  const [lockedFor, setLockedFor] = useState(0)

  useEffect(() => {
    if (lockedFor <= 0) return
    const id = window.setTimeout(() => setLockedFor((s) => Math.max(0, s - 1)), 1000)

    return () => window.clearTimeout(id)
  }, [lockedFor])

  const mutation = useMutation({
    mutationFn: authApi.resendVerification,
    onSuccess: () => {
      toast.success(t('verifyBanner.sent'))
      setLockedFor(RESEND_COOLDOWN_SEC)
    },
    onError: (err) => {
      const code = errorCode(err)
      if (code === 'CONFLICT') {
        toast.info(t('verifyBanner.alreadyVerified'))
        void loadMe()
      } else if (code === 'RATE_LIMITED') {
        // The global handler shows the toast with the wait time.
        setLockedFor(retryAfterOf(err))
      } else {
        toast.error(msg(errorKeyOf(err)))
      }
    },
  })

  return { resend: () => mutation.mutate(), isPending: mutation.isPending, lockedFor }
}

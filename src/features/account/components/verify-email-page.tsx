import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { CircleCheckIcon, Loader2Icon, MailXIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { errorCode } from '@/lib/api-error'
import { useResendVerification } from '@/features/account/hooks/use-resend-verification'
import { authApi } from '@/features/auth/api/auth-api'
import { loadMe } from '@/features/auth/lib/session'
import { useAuthModal } from '@/features/auth/stores/auth-modal-store'
import { useAuthStore } from '@/features/auth/stores/auth-store'
import { useUrlToken } from '@/features/account/hooks/use-url-token'

type State = 'verifying' | 'success' | 'invalid' | 'error' | 'missing'

// One request per token for the page's lifetime: tokens are single-use, and StrictMode runs effects twice.
const attempts = new Map<string, Promise<State>>()

function verifyOnce(token: string): Promise<State> {
  let p = attempts.get(token)
  if (!p) {
    p = authApi
      .verifyEmail(token)
      .then((): State => 'success')
      .catch((err: unknown): State => (errorCode(err) === 'TOKEN_INVALID' || errorCode(err) === 'VALIDATION_FAILED' ? 'invalid' : 'error'))
    attempts.set(token, p)
  }

  return p
}

/** /verify-email?token= (NXL-D §3.1, AF-D03): works signed in or not; the token leaves the URL at once. */
export function VerifyEmailPage() {
  const { t } = useTranslation(['account', 'common'])
  const token = useUrlToken()
  const [state, setState] = useState<State>(token ? 'verifying' : 'missing')
  const signedIn = useAuthStore((s) => s.status === 'authenticated')
  const verified = useAuthStore((s) => s.user?.emailVerified ?? false)
  const show = useAuthModal((s) => s.show)
  const { resend, isPending, lockedFor } = useResendVerification()

  useEffect(() => {
    if (!token) return
    let alive = true
    void verifyOnce(token).then((result) => {
      if (!alive) return
      setState(result)
      if (result === 'success') void loadMe()
    })

    return () => {
      alive = false
    }
  }, [token])

  return (
    <section className="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-4 py-16 text-center" data-testid="verify-email" data-state={state}>
      {state === 'verifying' && (
        <>
          <Loader2Icon className="size-10 animate-spin text-primary" aria-hidden />
          <h1 className="font-heading text-headline-md" role="status">
            {t('verify.verifying')}
          </h1>
        </>
      )}

      {state === 'success' && (
        <>
          <CircleCheckIcon className="size-12 text-success" aria-hidden />
          <h1 className="font-heading text-headline-md">{t('verify.successTitle')}</h1>
          <p className="text-muted-foreground">{t('verify.successBody')}</p>
          {signedIn ? (
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild>
                <Link to="/creator/apply">{t('verify.toCreator')}</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link to="/">{t('common:actions.backHome')}</Link>
              </Button>
            </div>
          ) : (
            <Button onClick={() => show('login')}>{t('verify.login')}</Button>
          )}
        </>
      )}

      {(state === 'invalid' || state === 'missing' || state === 'error') && (
        <>
          <MailXIcon className="size-12 text-warning" aria-hidden />
          <h1 className="font-heading text-headline-md">{state === 'error' ? t('verify.errorTitle') : t('verify.invalidTitle')}</h1>
          <p className="text-muted-foreground">{state === 'error' ? t('verify.errorBody') : t('verify.invalidBody')}</p>
          {signedIn && !verified && (
            <Button onClick={resend} loading={isPending} disabled={lockedFor > 0}>
              {lockedFor > 0 ? t('verifyBanner.resendIn', { count: lockedFor }) : t('verify.resend')}
            </Button>
          )}
          {signedIn && verified && <p className="text-body-sm text-success">{t('verify.alreadyVerified')}</p>}
          {!signedIn && <Button onClick={() => show('login')}>{t('verify.loginToResend')}</Button>}
        </>
      )}
    </section>
  )
}

import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useRouteError, useSearchParams } from 'react-router'
import { CompassIcon, HouseIcon, RotateCwIcon, TimerOffIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LockedNotice } from '@/features/auth/components/locked-notice'
import { sanitizeReturnTo, savePendingAction } from '@/features/auth/lib/pending-action'
import { useAuthModal } from '@/features/auth/stores/auth-modal-store'
import { useAuthStore } from '@/features/auth/stores/auth-store'

function SystemScreen({ code, icon, title, body, children, testId }: { code?: string; icon?: ReactNode; title: string; body: string; children?: ReactNode; testId: string }) {
  return (
    <section className="grid place-items-center px-4 py-20 text-center" data-testid={testId}>
      <div className="flex max-w-md flex-col items-center gap-3">
        {icon}
        {code && <p className="font-heading text-[56px] leading-none font-bold text-primary">{code}</p>}
        <h1 className="font-heading text-headline-md">{title}</h1>
        <p className="text-muted-foreground">{body}</p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">{children}</div>
      </div>
    </section>
  )
}

/** 404 inside the app frame (NXL-00 §13). */
export function NotFoundPage() {
  const { t } = useTranslation(['system', 'common'])

  return (
    <SystemScreen code="404" title={t('notFound.title')} body={t('notFound.body')} testId="not-found">
      <Button asChild>
        <Link to="/">{t('common:actions.backHome')}</Link>
      </Button>
      <Button asChild variant="secondary">
        <Link to="/browse">
          <CompassIcon />
          {t('notFound.browse')}
        </Link>
      </Button>
    </SystemScreen>
  )
}

/** Router error boundary: an unexpected failure while rendering or loading a route ("500" + Thử lại). */
export function ServerErrorPage() {
  const { t } = useTranslation(['system', 'common'])
  const error = useRouteError()
  if (import.meta.env.DEV && error) console.error(error)

  return (
    <div className="min-h-dvh bg-background">
      <SystemScreen code="500" title={t('serverError.title')} body={t('serverError.body')} testId="server-error">
        <Button onClick={() => window.location.reload()}>
          <RotateCwIcon />
          {t('common:actions.retry')}
        </Button>
        <Button asChild variant="secondary">
          <a href="/">{t('common:actions.backHome')}</a>
        </Button>
      </SystemScreen>
    </div>
  )
}

/** /session-expired?returnTo= — a private page lost its session (NXL-00 §13, NXL-A E12). */
export function SessionExpiredPage() {
  const { t } = useTranslation(['system', 'common'])
  const [params] = useSearchParams()
  const show = useAuthModal((s) => s.show)
  const signedIn = useAuthStore((s) => s.status === 'authenticated')
  const returnTo = sanitizeReturnTo(params.get('returnTo'))

  const login = () => {
    savePendingAction({ type: 'navigate', params: { to: returnTo }, returnTo })
    show('login')
  }

  return (
    <SystemScreen
      icon={<TimerOffIcon className="size-12 text-warning" aria-hidden />}
      title={t('sessionExpired.title')}
      body={t('sessionExpired.body')}
      testId="session-expired"
    >
      {signedIn ? (
        <Button asChild>
          <Link to={returnTo}>{t('sessionExpired.continue')}</Link>
        </Button>
      ) : (
        <Button onClick={login}>{t('sessionExpired.login')}</Button>
      )}
      <Button asChild variant="secondary">
        <Link to="/">{t('common:actions.backHome')}</Link>
      </Button>
    </SystemScreen>
  )
}

/** /account-locked?until= (NXL-D BR-D09, E-D05). */
export function AccountLockedPage() {
  const { t } = useTranslation('common')
  const [params] = useSearchParams()

  return (
    <section className="grid place-items-center px-4 py-20 max-md:py-10" data-testid="account-locked-page">
      <div className="flex w-full max-w-130 flex-col items-center gap-4 rounded-xl border bg-surface p-8 max-md:p-6">
        <LockedNotice until={params.get('until')} />
        <Button asChild variant="secondary" className="font-medium max-md:h-12 max-md:w-full">
          <Link to="/">
            <HouseIcon />
            {t('actions.backHome')}
          </Link>
        </Button>
      </div>
    </section>
  )
}

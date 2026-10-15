import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { CircleCheckIcon, LinkIcon, SettingsIcon, TriangleAlertIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Logo } from '@/app/shell/top-bar'
import { useUrlToken } from '@/features/account/hooks/use-url-token'
import { notificationsApi } from '@/features/notifications/api'
import type { NotificationType } from '@/features/notifications/types'
import { StatusCard } from '@/features/system/components/status-card'
import { errorCode } from '@/lib/api-error'

type State = { kind: 'pending' } | { kind: 'done'; type: NotificationType | null } | { kind: 'invalid' } | { kind: 'failed' }

/** One request per token, even when React runs the effect twice in development. */
const inflight = new Map<string, ReturnType<typeof notificationsApi.unsubscribe>>()

/**
 * /notifications/unsubscribe?token= (25 · Hủy nhận email): no account needed — the token names the person and the
 * e-mail type. Calls the API on arrival; the token leaves the address bar at once.
 */
export function UnsubscribePage() {
  const { t } = useTranslation('notifications')
  const token = useUrlToken()
  const [state, setState] = useState<State>(token ? { kind: 'pending' } : { kind: 'invalid' })

  useEffect(() => {
    if (!token) return
    let alive = true
    const call = inflight.get(token) ?? notificationsApi.unsubscribe(token)
    inflight.set(token, call)
    call
      .then((type) => alive && setState({ kind: 'done', type }))
      .catch((err: unknown) => {
        inflight.delete(token)
        if (!alive) return
        const code = errorCode(err)
        setState(code === 'TOKEN_INVALID' || code === 'VALIDATION_FAILED' ? { kind: 'invalid' } : { kind: 'failed' })
      })

    return () => {
      alive = false
    }
  }, [token])

  const openSettings = (primary: boolean) => (
    <Button asChild variant={primary ? 'default' : 'secondary'} className={primary ? undefined : 'font-medium'}>
      <Link to="/settings/notifications">
        <SettingsIcon />
        {t('unsubscribe.openSettings')}
      </Link>
    </Button>
  )

  return (
    <main className="flex min-h-dvh flex-col items-center gap-12 bg-background px-4 py-8 md:gap-30 md:py-12" data-testid="unsubscribe-page">
      <Logo />
      {state.kind === 'pending' && (
        <section className="flex w-full max-w-120 flex-col items-center gap-4 rounded-xl border bg-surface p-8" role="status" aria-busy>
          <Spinner className="size-9 text-primary" />
          <p className="text-body-md text-muted-foreground">{t('unsubscribe.pending')}</p>
        </section>
      )}
      {state.kind === 'done' && (
        <StatusCard icon={<CircleCheckIcon />} tone="success" title={t('unsubscribe.doneTitle')} actions={openSettings(true)} className="max-w-120">
          {state.type ? t('unsubscribe.doneBody', { type: t(`settings.types.${state.type}`) }) : t('unsubscribe.doneBodyGeneric')}
        </StatusCard>
      )}
      {state.kind === 'invalid' && <StatusCard icon={<LinkIcon />} tone="warning" title={t('unsubscribe.invalidTitle')} actions={openSettings(false)} className="max-w-120" />}
      {state.kind === 'failed' && <StatusCard icon={<TriangleAlertIcon />} tone="warning" title={t('unsubscribe.failedTitle')} actions={openSettings(false)} className="max-w-120" />}
    </main>
  )
}

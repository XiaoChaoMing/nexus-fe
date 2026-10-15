import { useTranslation } from 'react-i18next'
import { LockIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { lockedUntilText } from '@/features/auth/lib/locked'

type LockedNoticeProps = {
  /** RFC 3339 end of a temporary lock (failed sign-ins or an Admin lock); null for a lock without an end. */
  until: string | null
  onRetry?: () => void
}

/**
 * "Tài khoản bị khóa" (12 · Trang hệ thống, NXL-D BR-D09, NXL-F §3.10): until a time, or by an administrator
 * without an end. Used by the sign-in form and the /account-locked page.
 */
export function LockedNotice({ until, onRetry }: LockedNoticeProps) {
  const { t } = useTranslation('auth')
  const valid = until !== null && !Number.isNaN(Date.parse(until))

  return (
    <div role="alert" data-testid="account-locked" className="flex flex-col items-center gap-4 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-destructive/15 text-destructive" aria-hidden>
        <LockIcon className="size-7" />
      </span>
      <h2 className="text-headline-md leading-6.75 font-bold text-foreground">{valid ? t('locked.titleUntil', { time: lockedUntilText(until) }) : t('locked.titleAdmin')}</h2>
      {valid && <p className="text-body-md text-muted-foreground">{t('locked.bodyUntil')}</p>}
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          {t('locked.back')}
        </Button>
      )}
    </div>
  )
}

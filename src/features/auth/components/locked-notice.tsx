import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { LockIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/format'

type LockedNoticeProps = {
  /** RFC 3339 end of a temporary lock; null for a lock set by an administrator. */
  until: string | null
  onRetry?: () => void
  onNavigate?: () => void
}

/** "Tài khoản tạm khóa" (NXL-D BR-D09, E-D04/E-D05) with the unlock time when there is one. */
export function LockedNotice({ until, onRetry, onNavigate }: LockedNoticeProps) {
  const { t } = useTranslation('auth')
  const valid = until !== null && !Number.isNaN(Date.parse(until))

  return (
    <div role="alert" data-testid="account-locked" className="flex flex-col items-center gap-3 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-warning/15 text-warning" aria-hidden>
        <LockIcon className="size-6" />
      </span>
      <h2 className="font-heading text-headline-sm">{valid ? t('locked.titleTemporary') : t('locked.title')}</h2>
      <p className="text-body-sm text-muted-foreground">
        {valid ? t('locked.bodyTemporary', { time: formatDate(until, { dateStyle: 'medium', timeStyle: 'short' }) }) : t('locked.body')}
      </p>
      {valid && (
        <p className="text-body-sm text-muted-foreground">
          {t('locked.resetHint')}{' '}
          <Link to="/forgot-password" onClick={onNavigate} className="font-semibold text-primary hover:underline">
            {t('login.forgot')}
          </Link>
        </p>
      )}
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          {t('locked.back')}
        </Button>
      )}
    </div>
  )
}

import { useTranslation } from 'react-i18next'
import { UserIcon } from 'lucide-react'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

type Props = {
  count: number | null | undefined
  /** `overlay`: on a picture (thumbnail, player); `plain`: in text rows. */
  variant?: 'overlay' | 'plain'
  className?: string
}

/** Viewer Count (brief C0): person icon + "1.234"; nothing when the count is unknown (null). */
export function ViewerCount({ count, variant = 'plain', className }: Props) {
  const { t } = useTranslation()
  if (typeof count !== 'number') return null
  const label = t('viewers', { count })

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 tabular-nums',
        variant === 'overlay' ? 'rounded-control bg-overlay px-1.5 py-0.5 text-label-sm font-semibold text-foreground' : 'text-label-sm font-medium text-muted-foreground',
        className,
      )}
      title={label}
      aria-label={label}
      data-testid="viewer-count"
    >
      <UserIcon className="size-3.5" aria-hidden />
      {formatNumber(count)}
    </span>
  )
}

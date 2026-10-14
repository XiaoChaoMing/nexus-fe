import { useTranslation } from 'react-i18next'
import { UserIcon } from 'lucide-react'
import { compactCount, formatViewers } from '@/lib/format'
import { cn } from '@/lib/utils'

type Props = {
  count: number | null | undefined
  /** `overlay`: on a picture (thumbnail, player); `plain`: in text rows. */
  variant?: 'overlay' | 'plain'
  className?: string
}

/**
 * Viewer Count (Components GĐ3 · Chat): red person icon + "1.234" (≥ 1 million: "1,2 Tr"); on pictures the GĐ4 card
 * style "1,2K". Hidden when unknown.
 */
export function ViewerCount({ count, variant = 'plain', className }: Props) {
  const { t } = useTranslation()
  if (typeof count !== 'number') return null
  const label = t('viewers', { count })

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 tabular-nums',
        variant === 'overlay' ? 'rounded-control bg-overlay py-0.75 pr-2 pl-1.5 text-label-sm font-semibold text-white' : 'text-body-sm font-semibold text-foreground',
        className,
      )}
      title={label}
      aria-label={label}
      data-testid="viewer-count"
    >
      <UserIcon className={cn('fill-live text-live', variant === 'overlay' ? 'size-3.75' : 'size-4')} aria-hidden />
      {variant === 'overlay' ? compactCount(count) : formatViewers(count)}
    </span>
  )
}

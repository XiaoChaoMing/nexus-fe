import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import type { StreamStatus } from '@/features/streams/types'
import { languageName } from '@/lib/format'
import { cn } from '@/lib/utils'

/** "TRỰC TIẾP" (red, with dot), "Tạm gián đoạn" (amber) or "Đã kết thúc". */
export function StreamStatusBadge({ status, className }: { status: StreamStatus; className?: string }) {
  const { t } = useTranslation()

  if (status === 'LIVE') {
    return (
      <Badge variant="live" className={cn('px-2 py-0.75 text-[11px] tracking-wide', className)}>
        {t('status.onAir')}
      </Badge>
    )
  }
  if (status === 'INTERRUPTED') {
    return (
      <Badge variant="warning" className={cn('px-2 py-0.75 text-[11px]', className)}>
        {t('status.interrupted')}
      </Badge>
    )
  }

  return (
    <Badge variant="secondary" className={cn('px-2 py-0.75 text-[11px]', className)}>
      {t('status.ended')}
    </Badge>
  )
}

/** Tag/Chip: hover-surface pill, 12px secondary text. */
export function TagChip({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn('inline-flex max-w-full items-center truncate rounded-sm bg-accent px-2 py-0.5 text-label-sm font-normal text-muted-foreground', className)}>{children}</span>
}

type StreamTagsProps = {
  language?: string
  tags?: string[]
  mature?: boolean
  /** Cards show at most this many chips. */
  max?: number
  className?: string
}

/** Language first, then the Creator's tags; 18+ as a warning chip. Categories arrive in GĐ4. */
export function StreamTags({ language, tags = [], mature, max, className }: StreamTagsProps) {
  const { t } = useTranslation()
  const chips = [...(language ? [languageName(language)] : []), ...tags]
  const shown = max === undefined ? chips : chips.slice(0, max)

  if (shown.length === 0 && !mature) return null

  return (
    <div className={cn('flex min-w-0 flex-wrap items-center gap-1.5', className)}>
      {mature && <span className="rounded-control border border-warning px-1.5 py-px text-[11px] font-bold text-warning">{t('status.mature')}</span>}
      {shown.map((c, i) => (
        <TagChip key={`${c}-${i}`}>{c}</TagChip>
      ))}
    </div>
  )
}

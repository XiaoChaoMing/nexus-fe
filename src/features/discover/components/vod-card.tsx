import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Skeleton } from '@/components/ui/skeleton'
import { channelName } from '@/features/channels/lib/channel-display'
import { Thumbnail } from '@/features/home/components/thumbnail'
import type { Vod } from '@/features/streams/types'
import { formatDuration, relativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Card/VOD: 16:9 thumbnail + duration, two-line title, channel, "Phát 3 ngày trước" — no view count (until GĐ7). */
export function VodCard({ vod, now, showChannel = true, className }: { vod: Vod; now: number; showChannel?: boolean; className?: string }) {
  const { t } = useTranslation('discover')
  const name = channelName(vod.channel)

  return (
    <Link to={`/vod/${vod.id}`} className={cn('group flex min-w-0 flex-col gap-2.5 rounded-lg outline-none', className)} data-testid="vod-card">
      <span className="relative block aspect-video overflow-hidden rounded-lg group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-ring">
        <Thumbnail src={vod.thumbnailUrl} className="size-full transition-transform duration-300 group-hover:scale-[1.02]" />
        <span className="absolute right-2 bottom-2 rounded-sm bg-overlay px-1.5 py-0.5 text-[11px] font-semibold text-white tabular-nums">{formatDuration(vod.durationSec)}</span>
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="line-clamp-2 text-[15px] leading-5 font-semibold text-foreground group-hover:text-primary" title={vod.title}>
          {vod.title}
        </span>
        {showChannel && name && <span className="truncate text-body-sm text-muted-foreground">{name}</span>}
        <span className="text-label-sm font-normal text-muted-foreground">{t('card.streamed', { time: relativeTime(vod.createdAt, now) })}</span>
      </span>
    </Link>
  )
}

export function VodCardSkeleton() {
  return (
    <div className="flex flex-col gap-2.5" aria-hidden>
      <Skeleton className="aspect-video w-full" />
      <Skeleton className="h-3.5 w-full rounded-sm" />
      <Skeleton className="h-3 w-30 rounded-sm" />
    </div>
  )
}

export const VOD_GRID = 'grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-x-4 md:gap-y-6 xl:grid-cols-4'

import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { channelName } from '@/features/channels/lib/channel-display'
import { watchedPercent } from '@/features/home/lib/featured'
import { Thumbnail } from '@/features/home/components/thumbnail'
import { formatTimecode } from '@/features/player/lib/live-edge'
import type { ContinueWatchingItem } from '@/features/streams/types'
import { relativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Card/Continue: replay thumbnail with duration and progress bar, "Đã xem N%", title and channel. */
export function ContinueCard({ item, now, className }: { item: ContinueWatchingItem; now: number; className?: string }) {
  const { t } = useTranslation('home')
  const { vod } = item
  const pct = watchedPercent(item.positionSec, vod.durationSec)

  return (
    <Link
      to={`/vod/${vod.id}`}
      className={cn('group flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card outline-none hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring', className)}
      data-testid="continue-card"
    >
      <span className="relative block aspect-video">
        <Thumbnail src={vod.thumbnailUrl} className="size-full" />
        <span className="absolute right-2 bottom-3 rounded-sm bg-overlay px-1.5 py-0.5 text-[11px] font-semibold text-white tabular-nums">{formatTimecode(vod.durationSec)}</span>
        <span className="absolute inset-x-0 bottom-0 h-0.75 bg-border" aria-hidden>
          <span className="block h-full bg-primary" style={{ width: `${pct}%` }} />
        </span>
      </span>
      <span className="flex flex-col gap-1 px-3.5 pt-3 pb-3.5">
        <span className="flex items-center justify-between gap-2 text-label-sm font-normal">
          <span className="truncate text-subtle-foreground">{t('continue.streamed', { time: relativeTime(vod.createdAt, now) })}</span>
          <span className="shrink-0 font-semibold text-primary">{t('continue.watched', { percent: pct })}</span>
        </span>
        <span className="truncate text-[15px] leading-5 font-semibold text-foreground group-hover:text-primary" title={vod.title}>
          {vod.title}
        </span>
        {channelName(vod.channel) && <span className="truncate text-body-sm text-muted-foreground">{channelName(vod.channel)}</span>}
      </span>
    </Link>
  )
}

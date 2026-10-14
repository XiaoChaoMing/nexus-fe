import { Link } from 'react-router'
import { ChannelAvatar } from '@/features/channels/components/channel-avatar'
import { channelName } from '@/features/channels/lib/channel-display'
import { thumbSrc } from '@/features/home/lib/featured'
import { Thumbnail } from '@/features/home/components/thumbnail'
import { StreamStatusBadge, StreamTags } from '@/features/streams/components/stream-meta'
import { ViewerCount } from '@/features/streams/components/viewer-count'
import type { Stream } from '@/features/streams/types'
import { cn } from '@/lib/utils'

/** Card/Stream: 16:9 thumbnail with the live badge, avatar, title, channel and two tag chips. */
export function StreamCard({ stream: s, now, className }: { stream: Stream; now: number; className?: string }) {
  const name = channelName(s.channel)

  return (
    <Link to={`/live/${s.id}`} className={cn('group flex min-w-0 flex-col gap-2.5 rounded-lg outline-none', className)} data-testid="stream-card">
      <span className="relative block aspect-video overflow-hidden rounded-lg group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-ring">
        <Thumbnail src={thumbSrc(s.thumbnailUrl, now)} className="size-full transition-transform duration-300 group-hover:scale-[1.02]" />
        <StreamStatusBadge status={s.status} className="absolute top-2 left-2" />
        <ViewerCount count={s.viewerCount} variant="overlay" className="absolute bottom-2 left-2" />
      </span>
      <span className="flex min-w-0 gap-2.5">
        <ChannelAvatar channel={s.channel} size="md" className="mt-0.5" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.75">
          <span className="truncate text-[15px] leading-5 font-semibold text-foreground group-hover:text-primary" title={s.title}>
            {s.title}
          </span>
          {name && (
            <span className="truncate text-body-sm text-muted-foreground" data-testid="card-channel">
              {name}
            </span>
          )}
          <StreamTags language={s.language} tags={s.tags} mature={s.isMature} max={2} className="flex-nowrap overflow-hidden pt-1" />
        </span>
      </span>
    </Link>
  )
}

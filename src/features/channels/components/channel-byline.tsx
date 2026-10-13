import { ChannelAvatar } from '@/features/channels/components/channel-avatar'
import { channelName } from '@/features/channels/lib/channel-display'
import type { ChannelSummary } from '@/features/streams/types'
import { cn } from '@/lib/utils'

type ChannelBylineProps = {
  channel: ChannelSummary | null | undefined
  size?: 'sm' | 'default' | 'lg'
  live?: boolean
  showHandle?: boolean
  className?: string
}

/** Avatar + channel name; renders nothing for streams created before channels existed. */
export function ChannelByline({ channel, size = 'default', live, showHandle = false, className }: ChannelBylineProps) {
  const name = channelName(channel)
  if (!channel || !name) return null

  return (
    <div className={cn('flex min-w-0 items-center gap-2', className)} data-testid="channel-byline">
      <ChannelAvatar channel={channel} size={size} live={live} />
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-label-md font-semibold text-foreground" data-testid="channel-name">
          {name}
        </span>
        {showHandle && channel.handle && <span className="truncate text-body-sm text-muted-foreground">@{channel.handle}</span>}
      </div>
    </div>
  )
}

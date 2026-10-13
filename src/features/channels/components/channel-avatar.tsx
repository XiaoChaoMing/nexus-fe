import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { channelInitial } from '@/features/channels/lib/channel-display'
import type { ChannelSummary } from '@/features/streams/types'

type ChannelAvatarProps = {
  channel: ChannelSummary | null | undefined
  size?: 'default' | 'sm' | 'lg' | 'xl'
  live?: boolean
  className?: string
}

/** Channel picture, or its initial on a tinted disc until a picture exists (GĐ4 uploads). */
export function ChannelAvatar({ channel, size = 'default', live, className }: ChannelAvatarProps) {
  return (
    <Avatar size={size} live={live} className={className}>
      {channel?.avatarUrl && <AvatarImage src={channel.avatarUrl} alt="" />}
      <AvatarFallback className="bg-primary/15 font-semibold text-primary" aria-hidden>
        {channelInitial(channel)}
      </AvatarFallback>
    </Avatar>
  )
}

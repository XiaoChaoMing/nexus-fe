import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { channelInitials } from '@/features/channels/lib/channel-display'
import type { ChannelSummary } from '@/features/streams/types'
import { cn } from '@/lib/utils'

type ChannelAvatarProps = {
  channel: ChannelSummary | null | undefined
  size?: 'default' | 'sm' | 'md' | 'lg' | 'xl'
  /** Crimson ring around the picture. */
  live?: boolean
  /** Small crimson dot on the bottom-right edge (sidebar lists). */
  liveDot?: boolean
  className?: string
}

/** Channel picture, or its initials on the avatar disc until a picture exists (GĐ4 uploads). */
export function ChannelAvatar({ channel, size = 'default', live, liveDot, className }: ChannelAvatarProps) {
  const avatar = (
    <Avatar size={size} live={live} className={liveDot ? undefined : className}>
      {channel?.avatarUrl && <AvatarImage src={channel.avatarUrl} alt="" className="object-cover" />}
      <AvatarFallback aria-hidden>{channelInitials(channel, size === 'sm' ? 1 : 2)}</AvatarFallback>
    </Avatar>
  )

  if (!liveDot) return avatar

  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      {avatar}
      <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full bg-live ring-2 ring-surface" aria-hidden />
    </span>
  )
}

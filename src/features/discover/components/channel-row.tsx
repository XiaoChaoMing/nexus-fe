import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { BadgeCheckIcon } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { channelInitials } from '@/features/channels/lib/channel-display'
import { profilePath } from '@/features/channels/lib/handle'
import type { ChannelCard } from '@/features/channels/types'
import { cn } from '@/lib/utils'

type Props = {
  channel: Pick<ChannelCard, 'handle' | 'displayName' | 'avatarUrl'> & { verified?: boolean }
  /** "@kaelen · 12,4K người theo dõi" or the search subtitle. */
  meta?: string | null
  /** Live: "Valorant · 1,2K người xem"; offline: "Phát lần cuối 2 ngày trước". */
  sub?: string | null
  live?: boolean
  /** Avatar 40 (lists) or 64 (search results). */
  large?: boolean
  action?: ReactNode
  className?: string
}

/** Card/Channel: avatar (red ring when live), name + verified (+ LIVE), handle line, status line, follow action. */
export function ChannelRow({ channel, meta, sub, live = false, large = false, action, className }: Props) {
  const { t } = useTranslation(['channel', 'common'])
  const name = channel.displayName || channel.handle

  return (
    <div className={cn('relative flex min-w-0 items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-accent', className)} data-testid="channel-row">
      <Avatar size={large ? 'xl' : 'lg'} live={live} className={cn(!live && 'opacity-100', !live && sub && 'opacity-60')}>
        {channel.avatarUrl && <AvatarImage src={channel.avatarUrl} alt="" className="object-cover" />}
        <AvatarFallback aria-hidden>{channelInitials(channel)}</AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col gap-0.75">
        <span className="flex min-w-0 items-center gap-1.5">
          <Link to={profilePath(channel.handle)} className="truncate text-[15px] font-semibold text-foreground outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:underline">
            {name}
          </Link>
          {channel.verified && <BadgeCheckIcon className="size-4 shrink-0 text-primary" aria-label={t('channel:profile.verified')} />}
          {live && <span className="inline-flex shrink-0 items-center gap-1 rounded-control bg-live px-2 py-0.5 text-[10px] font-bold text-white uppercase">{t('common:status.liveShort')}</span>}
        </span>
        {meta && <span className="truncate text-body-sm text-muted-foreground">{meta}</span>}
        {sub && <span className={cn('truncate text-[12.5px]', live ? 'text-foreground' : 'text-muted-foreground')}>{sub}</span>}
      </div>
      {action && <div className="relative z-10 shrink-0">{action}</div>}
    </div>
  )
}

export function ChannelRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5" aria-hidden>
      <Skeleton className="size-10 shrink-0 rounded-full" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-3.5 w-40 rounded-sm" />
        <Skeleton className="h-3 w-28 rounded-sm" />
      </div>
    </div>
  )
}

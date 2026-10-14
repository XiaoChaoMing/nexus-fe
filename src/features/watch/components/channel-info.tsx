import { useTranslation } from 'react-i18next'
import { ChannelAvatar } from '@/features/channels/components/channel-avatar'
import { FollowButton } from '@/features/channels/components/follow-button'
import { ShareButton } from '@/features/channels/components/share-button'
import { channelName } from '@/features/channels/lib/channel-display'
import { StreamStatusBadge, StreamTags } from '@/features/streams/components/stream-meta'
import { ViewerCount } from '@/features/streams/components/viewer-count'
import type { Stream } from '@/features/streams/types'
import { relativeTime } from '@/lib/format'

type Props = {
  stream: Stream
  now: number
  layout: 'desktop' | 'tablet' | 'mobile'
  /** Mobile with the Chat tab open: only the channel row stays (the title is under "Giới thiệu"). */
  compact?: boolean
}

/**
 * Card/Channel Info (03 · Phòng Live): desktop — 64 px avatar, name + status, title, "Bắt đầu N giờ trước",
 * Follow + Share, tags; tablet — 48 px avatar row, title and tags below; mobile — flat rows under the player.
 * Follower counts and the verified mark need GĐ4 data and are not shown.
 */
export function ChannelInfo({ stream: s, now, layout, compact = false }: Props) {
  const { t } = useTranslation('watch')
  const name = channelName(s.channel)
  const started = relativeTime(s.startedAt, now)
  const viewers = s.status !== 'ENDED' && typeof s.viewerCount === 'number' ? <ViewerCount count={s.viewerCount} /> : null
  const tags = <StreamTags language={s.language} tags={s.tags} mature={s.isMature} />

  if (layout === 'desktop') {
    return (
      <section className="flex flex-col gap-4 rounded-panel border bg-surface p-5" aria-label={t('channelInfo')}>
        <div className="flex items-center gap-4">
          {s.channel && <ChannelAvatar channel={s.channel} size="xl" className="ring-2 ring-primary" />}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex min-w-0 items-center gap-2">
              {name && (
                <span className="truncate font-heading text-headline-md font-bold text-foreground" data-testid="channel-name">
                  {name}
                </span>
              )}
              <StreamStatusBadge status={s.status} />
            </div>
            <h1 className="text-body-lg font-medium break-words text-foreground" title={s.title}>
              {s.title}
            </h1>
            {(viewers || s.startedAt) && (
              <p className="flex flex-wrap items-center gap-2 text-label-sm font-normal text-muted-foreground">
                {viewers}
                {viewers && s.startedAt && <span className="text-subtle-foreground" aria-hidden>·</span>}
                {s.startedAt && <span>{t('startedAgo', { time: started })}</span>}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <FollowButton channel={s.channel} />
            <ShareButton />
          </div>
        </div>
        {tags}
      </section>
    )
  }

  if (layout === 'tablet') {
    return (
      <section className="flex flex-col gap-3.5 rounded-panel border bg-surface p-4" aria-label={t('channelInfo')}>
        <div className="flex items-center gap-3">
          {s.channel && <ChannelAvatar channel={s.channel} size="lg" className="size-12 ring-2 ring-primary" />}
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {name && (
              <span className="truncate font-heading text-lg leading-6 font-bold text-foreground" data-testid="channel-name">
                {name}
              </span>
            )}
            <StreamStatusBadge status={s.status} />
          </div>
          <FollowButton channel={s.channel} className="h-11" />
          <ShareButton className="size-11" />
        </div>
        <h1 className="text-body-lg font-medium break-words text-foreground">{s.title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {tags}
          {viewers}
          {s.startedAt && <span className="text-label-sm font-normal text-muted-foreground">· {t('startedAgo', { time: started })}</span>}
        </div>
      </section>
    )
  }

  return (
    <section className="flex flex-col" aria-label={t('channelInfo')}>
      <div className="flex items-center gap-3 px-4 py-3">
        {s.channel && <ChannelAvatar channel={s.channel} size="lg" className="outline outline-border" />}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {name && (
            <span className="truncate text-body-lg font-semibold text-foreground" data-testid="channel-name">
              {name}
            </span>
          )}
        </div>
        <FollowButton channel={s.channel} className="h-11 px-3.5 text-body-sm" />
      </div>
      {/* With the Chat tab open the title block gives the chat its space; the heading stays for screen readers. */}
      <div className={compact ? 'sr-only' : 'flex flex-col gap-2.5 px-4 pb-3'}>
        <h1 className="text-body-lg leading-5.5 font-semibold break-words text-foreground">{s.title}</h1>
        <div className="flex flex-wrap items-center gap-1.5">
          {viewers}
          {tags}
          {s.startedAt && <span className="text-label-sm font-normal text-subtle-foreground">· {started}</span>}
        </div>
      </div>
    </section>
  )
}

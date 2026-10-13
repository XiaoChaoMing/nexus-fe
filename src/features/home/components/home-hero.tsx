import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { PlayIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ChannelAvatar } from '@/features/channels/components/channel-avatar'
import { FollowButton } from '@/features/channels/components/follow-button'
import { ShareButton } from '@/features/channels/components/share-button'
import { channelName } from '@/features/channels/lib/channel-display'
import { thumbSrc } from '@/features/home/lib/featured'
import { Thumbnail } from '@/features/home/components/thumbnail'
import { StreamStatusBadge } from '@/features/streams/components/stream-meta'
import type { Stream } from '@/features/streams/types'
import { languageName, relativeTime } from '@/lib/format'

/** Hero chip on the picture: dark scrim, secondary text. */
function HeroChip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-sm bg-overlay px-2 py-0.5 text-label-sm font-normal text-muted-foreground">{children}</span>
}

/**
 * Featured broadcast (01 · Trang chủ): full-bleed picture with the copy on the left from 768 px; a stacked card
 * on mobile. The viewer count, category and "Đối tác" wait for GĐ3/GĐ4.
 */
export function HomeHero({ stream: s, now }: { stream: Stream; now: number }) {
  const { t } = useTranslation(['home', 'common'])
  const name = channelName(s.channel)
  const watchPath = `/live/${s.id}`

  return (
    <section
      aria-labelledby="hero-title"
      data-testid="home-hero"
      className="relative overflow-hidden rounded-panel border bg-surface md:flex md:h-100 md:flex-col md:justify-between md:p-5 xl:h-120 xl:p-7"
    >
      <div className="relative h-48 md:absolute md:inset-0 md:h-auto">
        <Thumbnail src={thumbSrc(s.thumbnailUrl, now)} className="size-full" eager />
        <div className="absolute inset-0 hidden bg-linear-to-r from-background/95 via-background/60 to-background/0 md:block" aria-hidden />
        <div className="absolute inset-0 hidden bg-linear-to-t from-background/90 via-background/0 to-background/0 md:block" aria-hidden />
        <StreamStatusBadge status={s.status} className="absolute top-2.5 left-2.5 md:hidden" />
      </div>

      <div className="relative hidden justify-end md:flex">
        <span className="inline-flex items-center gap-2 rounded-lg border bg-overlay px-3 py-1.75 text-label-sm font-bold tracking-wide text-live">
          <span className="size-1.75 rounded-full bg-live" aria-hidden />
          {s.status === 'LIVE' ? t('home:hero.liveNow') : t('common:status.interrupted')}
        </span>
      </div>

      <div className="relative flex flex-col gap-3 p-4 md:max-w-180 md:gap-4 md:p-0">
        <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
          <span className="rounded-control bg-primary px-2 py-0.75 text-[11px] font-bold tracking-wide text-primary-foreground uppercase">{t('home:hero.featured')}</span>
          {s.language && <HeroChip>{languageName(s.language)}</HeroChip>}
          {s.tags.slice(0, 3).map((tag) => (
            <HeroChip key={tag}>{tag}</HeroChip>
          ))}
          {s.isMature && <HeroChip>{t('common:status.mature')}</HeroChip>}
        </div>
        <h2 id="hero-title" className="line-clamp-3 font-heading text-2xl md:line-clamp-2 leading-8 font-bold tracking-tight text-foreground md:text-[34px] md:leading-[41px] md:tracking-[-0.8px]">
          <Link to={watchPath} className="outline-none hover:text-primary focus-visible:underline">
            {s.title}
          </Link>
        </h2>
        {s.channel && (
          <div className="flex items-center gap-2.5 md:gap-3">
            <ChannelAvatar channel={s.channel} size="lg" className="max-md:size-8 md:ring-2 md:ring-primary" />
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-label-md text-muted-foreground md:text-[15px] md:font-semibold md:text-foreground">{name}</span>
              <span className="hidden truncate text-body-sm text-muted-foreground md:block">
                @{s.channel.handle} · {t('home:hero.started', { time: relativeTime(s.startedAt, now) })}
              </span>
            </div>
          </div>
        )}
        <div className="flex items-center gap-2.5 pt-1.5">
          <Button asChild className="h-12 flex-1 md:h-11.5 md:flex-none md:px-6">
            <Link to={watchPath} data-testid="hero-watch">
              <PlayIcon className="fill-current" />
              {t('home:hero.watch')}
            </Link>
          </Button>
          <FollowButton channel={s.channel} className="hidden h-11.5 px-5 md:inline-flex" />
          <ShareButton path={watchPath} className="hidden size-11.5 md:inline-flex" />
        </div>
      </div>
    </section>
  )
}

/** Skeleton/Hero: block lines where tags, title, creator and buttons will be. */
export function HomeHeroSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-panel border bg-surface md:h-100 md:justify-end md:p-5 xl:h-120 xl:p-7" aria-hidden>
      <Skeleton className="h-48 rounded-none md:hidden" />
      <div className="flex flex-col gap-4 p-4 md:max-w-180 md:p-0">
        <div className="flex gap-2">
          <Skeleton className="h-5 w-24 rounded-control" />
          <Skeleton className="h-5 w-30 rounded-control" />
        </div>
        <Skeleton className="h-8.5 w-full rounded-control" />
        <Skeleton className="h-8.5 w-105 max-w-full rounded-control" />
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <Skeleton className="h-3.5 w-40 rounded-sm" />
        </div>
        <div className="flex gap-2.5 pt-1.5">
          <Skeleton className="h-11.5 w-33 max-md:flex-1" />
          <Skeleton className="hidden h-11.5 w-29 md:block" />
        </div>
      </div>
    </div>
  )
}

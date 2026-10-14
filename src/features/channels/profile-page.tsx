import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useParams, useSearchParams } from 'react-router'
import {
  AtSignIcon,
  BadgeCheckIcon,
  CalendarDaysIcon,
  ChevronRightIcon,
  CompassIcon,
  FilmIcon,
  GlobeIcon,
  HouseIcon,
  MessageCircleIcon,
  Music2Icon,
  PlayIcon,
  SearchXIcon,
  SquarePlayIcon,
  UsersIcon,
  type LucideIcon,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { channelsApi } from '@/features/channels/api/channels-api'
import { FollowButton } from '@/features/channels/components/follow-button'
import { ScheduleCard } from '@/features/channels/components/schedule-card'
import { ShareButton } from '@/features/channels/components/share-button'
import { liveThumbnail } from '@/features/channels/hooks/use-following'
import { channelInitials } from '@/features/channels/lib/channel-display'
import { handleFromSegment, profilePath } from '@/features/channels/lib/handle'
import { groupByDay } from '@/features/channels/lib/schedule-days'
import type { ChannelProfileFull, SocialLink, SocialLinkType } from '@/features/channels/types'
import { EmptyPanel, ErrorPanel, LoadMore } from '@/features/discover/components/list-states'
import { VOD_GRID, VodCard, VodCardSkeleton } from '@/features/discover/components/vod-card'
import { useVodList } from '@/features/discover/hooks/use-live-list'
import { Thumbnail } from '@/features/home/components/thumbnail'
import { thumbSrc } from '@/features/home/lib/featured'
import { streamsApi } from '@/features/streams/api/streams-api'
import { useChannelProfile } from '@/features/streams/hooks/use-streams'
import { useAuthStore } from '@/features/auth/stores/auth-store'
import { MEDIA, useMediaQuery } from '@/hooks/use-media-query'
import { useNow } from '@/hooks/use-now'
import { isApiError } from '@/lib/api-error'
import { compactCount, formatDate, formatDuration, formatNumber, relativeTime } from '@/lib/format'
import { browserTimeZone, gmtLabel } from '@/lib/timezone'
import { cn } from '@/lib/utils'

const TABS = ['home', 'videos', 'about', 'schedule'] as const
type Tab = (typeof TABS)[number]

/** Upcoming broadcasts on the Trang chủ tab (≤ 3 in the next 14 days). */
const HOME_UPCOMING = 3
const HOME_VIDEOS = 4

function useChannelSchedule(channelId: string | undefined) {
  const viewer = useAuthStore((s) => s.user?.id ?? 'guest')

  return useQuery({
    queryKey: ['channels', 'schedule', channelId ?? '', viewer],
    queryFn: () => channelsApi.schedule(channelId ?? ''),
    enabled: Boolean(channelId),
    select: (d) => d?.items ?? [],
    staleTime: 60_000,
  })
}

function useLatestVods(channelId: string | undefined) {
  return useQuery({
    queryKey: ['vods', 'channel', channelId ?? '', 'latest'],
    queryFn: () => streamsApi.channelVods(channelId ?? '', null, HOME_VIDEOS),
    enabled: Boolean(channelId),
    select: (d) => d?.items ?? [],
    staleTime: 60_000,
  })
}

function ChannelHeader({ profile: p }: { profile: ChannelProfileFull }) {
  const { t } = useTranslation(['channel', 'common'])
  const now = useNow(60_000)
  const live = p.isLive && p.currentStream
  const viewers = p.currentStream?.viewerCount

  return (
    <header className="flex flex-col" data-testid="channel-header">
      <div className={cn('relative aspect-[16/5] w-full overflow-hidden md:rounded-xl', !p.bannerUrl && 'border bg-surface')}>
        {p.bannerUrl && <img src={p.bannerUrl} alt="" className="size-full object-cover" />}
      </div>
      <div className="relative flex flex-col gap-3 px-4 md:flex-row md:items-start md:gap-4 md:px-0 md:pt-4 md:pl-35">
        <Avatar
          className={cn(
            '-mt-9 size-18 ring-3 ring-background md:absolute md:top-0 md:left-6 md:mt-0 md:size-24 md:-translate-y-1/2 md:ring-4',
            live && 'ring-live',
          )}
        >
          {p.avatarUrl && <AvatarImage src={p.avatarUrl} alt="" className="object-cover" />}
          <AvatarFallback className="text-[22px] md:text-[28px]" aria-hidden>
            {channelInitials(p)}
          </AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h1 className="truncate font-heading text-[22px] leading-8 font-semibold text-foreground md:text-[28px] md:leading-9" data-testid="channel-name">
              {p.displayName || p.handle}
            </h1>
            {p.verified && <BadgeCheckIcon className="size-5 shrink-0 text-primary md:size-5.5" aria-label={t('channel:profile.verified')} />}
            {live && <span className="inline-flex items-center gap-1.5 rounded-control bg-live px-2 py-0.75 text-[11px] font-bold text-white uppercase">{t('common:status.onAir')}</span>}
          </div>
          <p className="text-body-md text-muted-foreground" data-testid="channel-meta">
            @{p.handle} · {t('channel:profile.followerCount', { value: formatNumber(p.followerCount) })}
          </p>
          {live && p.currentStream && (
            <Link
              to={`/live/${p.currentStream.id}`}
              className="mt-1 flex w-fit max-w-full items-center gap-2.5 rounded-lg border bg-card py-2 pr-3 pl-2 text-[13px] font-medium text-foreground hover:border-border-strong"
              data-testid="channel-now-playing"
            >
              <Thumbnail src={thumbSrc(liveThumbnail(p.currentStream.id), now)} className="h-9 w-16 shrink-0 overflow-hidden rounded-sm" />
              <span className="truncate">
                {viewers === null || viewers === undefined
                  ? t('channel:profile.nowPlayingNoCount', { title: p.currentStream.title })
                  : t('channel:profile.nowPlaying', { title: p.currentStream.title, viewers: compactCount(viewers) })}
              </span>
              <ChevronRightIcon className="size-4.5 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2 max-md:w-full">
          <FollowButton
            channel={p}
            seed={p.viewer ? { following: p.viewer.following, notifyLevel: p.viewer.notifyLevel } : null}
            owner={p.viewer?.isOwner}
            block
            className="max-md:flex-1"
          />
          <ShareButton path={profilePath(p.handle)} />
        </div>
      </div>
    </header>
  )
}

function SectionTitle({ id, title, onMore }: { id: string; title: string; onMore?: () => void }) {
  const { t } = useTranslation('channel')

  return (
    <div className="flex items-center justify-between">
      <h2 id={id} className="font-heading text-lg font-semibold text-foreground md:text-xl">
        {title}
      </h2>
      {onMore && (
        <button type="button" onClick={onMore} className="rounded-control text-label-md text-primary hover:underline">
          {t('profile.seeAll')}
        </button>
      )}
    </div>
  )
}

function HomeTab({ profile: p, setTab }: { profile: ChannelProfileFull; setTab: (t: Tab) => void }) {
  const { t } = useTranslation(['channel', 'common'])
  const now = useNow(30_000)
  const vods = useLatestVods(p.id)
  const schedule = useChannelSchedule(p.id)
  const narrow = !useMediaQuery(MEDIA.md)
  const s = p.isLive ? p.currentStream : null
  const latest = vods.data?.[0]
  const upcoming = (schedule.data ?? []).slice(0, HOME_UPCOMING)
  const nothing = !s && vods.isSuccess && schedule.isSuccess && vods.data.length === 0 && upcoming.length === 0

  if (nothing) return <EmptyPanel icon={FilmIcon} title={t('channel:profile.emptyHomeTitle')} body={t('channel:profile.emptyHomeBody', { name: p.displayName || p.handle })} testId="profile-home-empty" />

  return (
    <div className="flex flex-col gap-8">
      {s ? (
        <section className="grid gap-4 rounded-panel border bg-surface p-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] md:p-4" data-testid="profile-live-block">
          <Link to={`/live/${s.id}`} className="relative block aspect-video overflow-hidden rounded-lg outline-none focus-visible:outline-2 focus-visible:outline-ring">
            <Thumbnail src={thumbSrc(liveThumbnail(s.id), now)} className="size-full" eager />
            <span className="absolute top-2 left-2 rounded-control bg-live px-2 py-0.75 text-[11px] font-bold text-white uppercase">{t('common:status.onAir')}</span>
            <span className="absolute inset-0 grid place-items-center bg-black/20" aria-hidden>
              <PlayIcon className="size-12 fill-white text-white" />
            </span>
          </Link>
          <div className="flex min-w-0 flex-col justify-center gap-2.5">
            <h2 className="text-body-lg font-semibold break-words text-foreground">{s.title}</h2>
            <p className="flex flex-wrap items-center gap-2 text-body-sm text-muted-foreground">
              {s.category && (
                <Link to={`/browse/${s.category.slug}`} className="font-medium text-primary hover:underline">
                  {s.category.name}
                </Link>
              )}
              {s.viewerCount !== null && <span>{t('channel:profile.viewers', { value: compactCount(s.viewerCount) })}</span>}
              <span>· {t('channel:profile.startedAgo', { time: relativeTime(s.startedAt, now) })}</span>
            </p>
            <Button asChild className="w-fit max-md:h-11 max-md:w-full">
              <Link to={`/live/${s.id}`}>
                <PlayIcon />
                {t('channel:profile.watch')}
              </Link>
            </Button>
          </div>
        </section>
      ) : (
        <section className="grid gap-4 rounded-panel border bg-surface p-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] md:p-4" data-testid="profile-offline-block">
          <div className="relative aspect-video overflow-hidden rounded-lg bg-card">
            {latest && <Thumbnail src={latest.thumbnailUrl} className="size-full opacity-40 blur-[2px]" />}
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
              <span className="rounded-control bg-overlay px-2.5 py-1 text-label-sm font-bold text-foreground">{t('channel:profile.offline')}</span>
              <span className="text-body-sm text-muted-foreground">
                {p.lastLiveAt ? t('channel:profile.lastLive', { time: relativeTime(p.lastLiveAt, now) }) : t('channel:profile.neverLive')}
              </span>
            </span>
          </div>
          {latest && (
            <div className="flex min-w-0 flex-col justify-center gap-2">
              <span className="text-[11px] font-semibold tracking-[0.8px] text-subtle-foreground uppercase">{t('channel:profile.lastBroadcast')}</span>
              <h2 className="text-body-lg font-semibold break-words text-foreground">{latest.title}</h2>
              <p className="text-body-sm text-muted-foreground">{formatDuration(latest.durationSec)}</p>
              <Button asChild variant="secondary" className="w-fit max-md:h-11 max-md:w-full">
                <Link to={`/vod/${latest.id}`}>
                  <PlayIcon />
                  {t('channel:profile.watchReplay')}
                </Link>
              </Button>
            </div>
          )}
        </section>
      )}

      {(vods.isPending || (vods.data && vods.data.length > 0)) && (
        <section aria-labelledby="profile-latest" className="flex flex-col gap-4">
          <SectionTitle id="profile-latest" title={t('channel:profile.latestVideos')} onMore={() => setTab('videos')} />
          <div className={VOD_GRID}>
            {vods.isPending ? Array.from({ length: 4 }, (_, i) => <VodCardSkeleton key={i} />) : vods.data?.map((v) => <VodCard key={v.id} vod={v} now={now} showChannel={false} />)}
          </div>
        </section>
      )}

      {upcoming.length > 0 && (
        <section aria-labelledby="profile-upcoming" className="flex flex-col gap-4">
          <SectionTitle id="profile-upcoming" title={t('channel:profile.upcoming')} onMore={() => setTab('schedule')} />
          <div className="flex flex-col gap-3">
            {upcoming.map((o) => (
              <ScheduleCard key={`${o.scheduleId}-${o.occurrenceAt}`} occurrence={o} channelId={p.id} now={now} compact={narrow} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function VideosTab({ profile: p }: { profile: ChannelProfileFull }) {
  const { t } = useTranslation('channel')
  const now = useNow(60_000)
  const list = useVodList(['vods', 'channel', p.id, 'all'], (cursor) => streamsApi.channelVods(p.id, cursor))

  if (list.isError && !list.data) return <ErrorPanel icon={FilmIcon} title={t('profile.loadFailed')} onRetry={() => void list.refetch()} />
  if (list.isPending) {
    return (
      <div className={VOD_GRID} aria-busy>
        {Array.from({ length: 8 }, (_, i) => (
          <VodCardSkeleton key={i} />
        ))}
      </div>
    )
  }
  if (list.items.length === 0) return <EmptyPanel icon={FilmIcon} title={t('profile.videosEmptyTitle')} body={t('profile.videosEmptyBody')} testId="profile-videos-empty" />

  return (
    <>
      <div className={VOD_GRID} data-testid="profile-videos">
        {list.items.map((v) => (
          <VodCard key={v.id} vod={v} now={now} showChannel={false} />
        ))}
      </div>
      <LoadMore hasMore={Boolean(list.hasNextPage)} loading={list.isFetchingNextPage} failed={list.isFetchNextPageError} onMore={() => void list.fetchNextPage()} />
    </>
  )
}

const LINK_ICONS: Record<SocialLinkType, LucideIcon> = {
  YOUTUBE: SquarePlayIcon,
  X: AtSignIcon,
  FACEBOOK: UsersIcon,
  TIKTOK: Music2Icon,
  DISCORD: MessageCircleIcon,
  WEBSITE: GlobeIcon,
}

/** "youtube.com/@kaelen": host without www + path, no protocol or trailing slash. */
function shortUrl(url: string): string {
  try {
    const u = new URL(url)

    return `${u.host.replace(/^www\./, '')}${u.pathname === '/' ? '' : u.pathname.replace(/\/$/, '')}`
  } catch {
    return url
  }
}

function AboutTab({ profile: p }: { profile: ChannelProfileFull }) {
  const { t } = useTranslation('channel')
  const bio = p.bio?.trim()

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
      <section className="flex flex-col gap-3 rounded-panel border bg-surface p-5">
        <h2 className="font-heading text-headline-sm text-foreground">{t('profile.aboutHeading', { name: p.displayName || p.handle })}</h2>
        <p className="text-body-md whitespace-pre-line text-muted-foreground" data-testid="channel-bio">
          {bio || t('profile.noBio')}
        </p>
        <p className="flex items-center gap-2 text-body-sm text-subtle-foreground">
          <CalendarDaysIcon className="size-4" aria-hidden />
          {t('profile.joined', { date: formatDate(p.createdAt, { month: '2-digit', year: 'numeric' }) })}
        </p>
      </section>
      {(p.socialLinks ?? []).length > 0 && (
        <section className="flex flex-col gap-2 rounded-panel border bg-surface p-5" aria-labelledby="profile-links">
          <h2 id="profile-links" className="font-heading text-headline-sm text-foreground">
            {t('profile.links')}
          </h2>
          <ul className="flex flex-col">
            {(p.socialLinks ?? []).map((l: SocialLink, i) => {
              const Icon = LINK_ICONS[l.type] ?? GlobeIcon

              return (
                <li key={`${l.url}-${i}`}>
                  <a href={l.url} target="_blank" rel="noopener noreferrer nofollow" className="flex min-h-11 items-center gap-3 rounded-lg px-2 hover:bg-accent">
                    <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="flex min-w-0 flex-col">
                      <span className="text-label-md text-foreground">{t(`links.${l.type}`)}</span>
                      <span className="truncate text-label-sm font-normal text-muted-foreground">{shortUrl(l.url)}</span>
                    </span>
                  </a>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}

function ScheduleTab({ profile: p }: { profile: ChannelProfileFull }) {
  const { t } = useTranslation('channel')
  const now = useNow(30_000)
  const schedule = useChannelSchedule(p.id)
  const narrow = !useMediaQuery(MEDIA.md)
  const tz = browserTimeZone()

  if (schedule.isError && !schedule.data) return <ErrorPanel icon={CalendarDaysIcon} title={t('profile.loadFailed')} onRetry={() => void schedule.refetch()} />
  if (schedule.isPending) return <Skeleton className="h-60 rounded-panel" />
  if (schedule.data.length === 0) {
    return (
      <EmptyPanel icon={CalendarDaysIcon} title={t('profile.scheduleEmptyTitle')} body={t('profile.scheduleEmptyBody')} testId="profile-schedule-empty">
        <FollowButton channel={p} seed={p.viewer ? { following: p.viewer.following, notifyLevel: p.viewer.notifyLevel } : null} owner={p.viewer?.isOwner} />
      </EmptyPanel>
    )
  }
  const groups = groupByDay(schedule.data, (o) => Date.parse(o.occurrenceAt), now, tz)

  return (
    <div className="flex flex-col gap-6" data-testid="profile-schedule">
      <p className="text-body-sm text-muted-foreground">{t('profile.scheduleTimezone', { zone: gmtLabel(now, tz) })}</p>
      {groups.map((g) => (
        <section key={g.key} aria-label={g.key} className="flex flex-col gap-3">
          <h2 className="text-label-md font-semibold text-foreground">
            {g.label.kind === 'today'
              ? t('schedule.today')
              : g.label.kind === 'tomorrow'
                ? t('schedule.tomorrow')
                : formatDate(new Date(g.label.ms).toISOString(), { weekday: 'long', day: '2-digit', month: '2-digit' })}
          </h2>
          {g.items.map((o) => (
            <ScheduleCard key={`${o.scheduleId}-${o.occurrenceAt}`} occurrence={o} channelId={p.id} now={now} compact={narrow} />
          ))}
        </section>
      ))}
    </div>
  )
}

function ProfileNotFound() {
  const { t } = useTranslation(['channel', 'common'])

  return (
    <div className="grid place-items-center px-4 py-16">
      <EmptyPanel icon={SearchXIcon} title={t('channel:profile.notFoundTitle')} body={t('channel:profile.notFoundBody')} testId="profile-not-found" className="max-w-xl">
        <Button asChild>
          <Link to="/">
            <HouseIcon />
            {t('common:actions.backHome')}
          </Link>
        </Button>
        <Button asChild variant="secondary">
          <Link to="/browse">
            <CompassIcon />
            {t('channel:profile.discover')}
          </Link>
        </Button>
      </EmptyPanel>
    </div>
  )
}

/**
 * /:handle and /c/:handle — 04 · Trang Creator: header (banner 16:5, avatar, follow + bell, "Đang phát" link) and
 * the tabs Trang chủ · Video · Giới thiệu · Lịch (`?tab=`, switching does not reload). App routes win over
 * handles; reserved words resolve to a channel only under `/c/`.
 */
export function ProfilePage() {
  const { t } = useTranslation('channel')
  const { handle: segment } = useParams()
  const { pathname } = useLocation()
  const handle = handleFromSegment(segment, { allowReserved: pathname.startsWith('/c/') })
  const [sp, setSp] = useSearchParams()
  const raw = sp.get('tab')
  const tab: Tab = (TABS as readonly string[]).includes(raw ?? '') ? (raw as Tab) : 'home'
  const query = useChannelProfile(handle ?? undefined)
  const setTab = (next: Tab) => setSp(next === 'home' ? new URLSearchParams() : new URLSearchParams({ tab: next }), { replace: false })

  if (!handle || (query.isError && isApiError(query.error) && query.error.status === 404)) return <ProfileNotFound />
  if (query.isError) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-16">
        <ErrorPanel icon={UsersIcon} title={t('profile.loadFailed')} body={t('profile.loadFailedBody')} onRetry={() => void query.refetch()} />
      </div>
    )
  }
  if (!query.data) {
    return (
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 md:p-4 xl:p-6" aria-busy>
        <Skeleton className="aspect-[16/5] w-full rounded-none md:rounded-xl" />
        <Skeleton className="mx-4 h-16 md:mx-0" />
      </div>
    )
  }
  const p = query.data

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 pb-8 md:gap-6 md:p-4 xl:p-6">
      <ChannelHeader profile={p} />
      <div className="flex flex-col gap-5 px-4 md:gap-6 md:px-0">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList aria-label={t('profile.tabsLabel')} className="overflow-x-auto">
            {TABS.map((id) => (
              <TabsTrigger key={id} value={id}>
                {t(`profile.tabs.${id}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {tab === 'home' && <HomeTab profile={p} setTab={setTab} />}
        {tab === 'videos' && <VideosTab profile={p} />}
        {tab === 'about' && <AboutTab profile={p} />}
        {tab === 'schedule' && <ScheduleTab profile={p} />}
      </div>
    </div>
  )
}

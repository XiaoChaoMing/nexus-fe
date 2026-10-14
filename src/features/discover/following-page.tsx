import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { CompassIcon, HeartIcon, RadioTowerIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SkeletonStreamCard } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { savePendingAction } from '@/features/auth/lib/pending-action'
import { useAuthModal } from '@/features/auth/stores/auth-modal-store'
import { useAuthStore } from '@/features/auth/stores/auth-store'
import { useCategoryMap } from '@/features/categories/api'
import { FollowButton } from '@/features/channels/components/follow-button'
import { useFollowedAll, useFollowedLive } from '@/features/channels/hooks/use-following'
import type { FollowedChannel } from '@/features/channels/types'
import { ChannelRow, ChannelRowSkeleton } from '@/features/discover/components/channel-row'
import { EmptyPanel, ErrorPanel, LoadMore } from '@/features/discover/components/list-states'
import { StreamCard } from '@/features/home/components/stream-card'
import { STREAM_GRID } from '@/features/home/live-grid'
import { useNow } from '@/hooks/use-now'
import { compactCount, relativeTime } from '@/lib/format'

function GuestIntro() {
  const { t } = useTranslation('discover')
  const show = useAuthModal((s) => s.show)
  const open = (tab: 'login' | 'register') => {
    savePendingAction({ type: 'navigate', params: { to: '/following' }, returnTo: '/following' })
    show(tab)
  }

  return (
    <EmptyPanel icon={HeartIcon} title={t('following.guestTitle')} body={t('following.guestBody')} testId="following-intro">
      <Button onClick={() => open('login')}>{t('following.login')}</Button>
      <Button variant="secondary" onClick={() => open('register')}>
        {t('following.register')}
      </Button>
      <Button asChild variant="ghost">
        <Link to="/browse">
          <CompassIcon />
          {t('following.explore')}
        </Link>
      </Button>
    </EmptyPanel>
  )
}

function NothingFollowed() {
  const { t } = useTranslation('discover')

  return (
    <EmptyPanel icon={HeartIcon} title={t('following.emptyTitle')} body={t('following.emptyBody')} testId="following-empty">
      <Button asChild>
        <Link to="/browse">
          <CompassIcon />
          {t('following.discover')}
        </Link>
      </Button>
    </EmptyPanel>
  )
}

function LiveTab({ onAll }: { onAll: () => void }) {
  const { t } = useTranslation('discover')
  const now = useNow(30_000)
  const live = useFollowedLive()
  const all = useFollowedAll()

  if (live.isError && !live.data) return <ErrorPanel icon={RadioTowerIcon} title={t('following.loadFailed')} onRetry={() => void live.refetch()} />
  if (live.isPending) {
    return (
      <div className={STREAM_GRID} aria-busy>
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonStreamCard key={i} />
        ))}
      </div>
    )
  }
  if (live.streams.length === 0) {
    if (all.isSuccess && all.items.length === 0) return <NothingFollowed />

    return (
      <EmptyPanel icon={RadioTowerIcon} title={t('following.liveEmptyTitle')} testId="following-live-empty">
        <Button variant="secondary" onClick={onAll}>
          {t('following.seeAllChannels')}
        </Button>
      </EmptyPanel>
    )
  }

  return (
    <div className={STREAM_GRID} data-testid="following-live-grid">
      {live.streams.map((s) => (
        <StreamCard key={s.id} stream={s} now={now} />
      ))}
    </div>
  )
}

function FollowedRow({ f, now }: { f: FollowedChannel; now: number }) {
  const { t } = useTranslation('discover')
  const categories = useCategoryMap()
  const s = f.isLive ? f.currentStream : null
  const category = s?.category?.name ?? categories.get(s?.category?.id ?? '')?.name
  const viewers = s?.viewerCount !== null && s?.viewerCount !== undefined ? compactCount(s.viewerCount) : null
  const sub = s
    ? viewers === null
      ? (category ?? null)
      : category
        ? t('card.liveSub', { category, value: viewers })
        : t('card.liveSubNoCategory', { value: viewers })
    : f.lastLiveAt
      ? t('card.lastLive', { time: relativeTime(f.lastLiveAt, now) })
      : t('card.neverLive')

  return (
    <ChannelRow
      channel={f.channel}
      meta={`@${f.channel.handle}`}
      sub={sub}
      live={Boolean(s)}
      action={<FollowButton channel={f.channel} size="sm" seed={{ following: true, notifyLevel: f.notifyLevel }} />}
    />
  )
}

function AllTab() {
  const { t } = useTranslation('discover')
  const now = useNow(60_000)
  const all = useFollowedAll()

  if (all.isError && !all.data) return <ErrorPanel icon={HeartIcon} title={t('following.loadFailed')} onRetry={() => void all.refetch()} />
  if (all.isPending) {
    return (
      <div className="flex flex-col" aria-busy>
        {Array.from({ length: 6 }, (_, i) => (
          <ChannelRowSkeleton key={i} />
        ))}
      </div>
    )
  }
  if (all.items.length === 0) return <NothingFollowed />
  const live = all.items.filter((f) => f.isLive)
  const offline = all.items.filter((f) => !f.isLive)

  return (
    <div className="flex flex-col gap-6" data-testid="following-all">
      {live.length > 0 && (
        <section aria-labelledby="following-live-group" className="flex flex-col gap-1">
          <h2 id="following-live-group" className="px-3 text-[11px] font-semibold tracking-[0.8px] text-subtle-foreground uppercase">
            {t('following.liveGroup', { count: live.length })}
          </h2>
          {live.map((f) => (
            <FollowedRow key={f.channel.id} f={f} now={now} />
          ))}
        </section>
      )}
      {offline.length > 0 && (
        <section aria-labelledby="following-offline-group" className="flex flex-col gap-1">
          <h2 id="following-offline-group" className="px-3 text-[11px] font-semibold tracking-[0.8px] text-subtle-foreground uppercase">
            {t('following.offlineGroup', { count: offline.length })}
          </h2>
          {offline.map((f) => (
            <FollowedRow key={f.channel.id} f={f} now={now} />
          ))}
        </section>
      )}
      <LoadMore hasMore={Boolean(all.hasNextPage)} loading={all.isFetchingNextPage} failed={all.isFetchNextPageError} onMore={() => void all.fetchNextPage()} />
    </div>
  )
}

/** /following — 14 · Đang theo dõi: tabs Live / Tất cả (`?tab=all`); guests see the sign-in intro (NXL-C AF03). */
export function FollowingPage() {
  const { t } = useTranslation('discover')
  const signedIn = useAuthStore((s) => s.status === 'authenticated')
  const [sp, setSp] = useSearchParams()
  const tab = sp.get('tab') === 'all' ? 'all' : 'live'
  const setTab = (next: string) => setSp(next === 'all' ? new URLSearchParams({ tab: 'all' }) : new URLSearchParams(), { replace: true })

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 px-4 py-5 md:gap-6 md:p-4 xl:p-6">
      <h1 className="font-heading text-headline-lg">{t('following.title')}</h1>
      {!signedIn ? (
        <GuestIntro />
      ) : (
        <>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="live">{t('following.tabs.live')}</TabsTrigger>
              <TabsTrigger value="all">{t('following.tabs.all')}</TabsTrigger>
            </TabsList>
          </Tabs>
          {tab === 'live' ? <LiveTab onAll={() => setTab('all')} /> : <AllTab />}
        </>
      )}
    </div>
  )
}

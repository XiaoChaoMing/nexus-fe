import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { HistoryIcon, RadioTowerIcon, SparklesIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SkeletonContinueCard } from '@/components/ui/skeleton'
import { useGatedAction } from '@/features/auth/hooks/use-gated-action'
import { isCreator } from '@/features/auth/lib/roles'
import { useAuthStore } from '@/features/auth/stores/auth-store'
import { CreatorCta } from '@/features/creator/components/creator-cta'
import { ContinueCard } from '@/features/home/components/continue-card'
import { HomeHero, HomeHeroSkeleton } from '@/features/home/components/home-hero'
import { SectionHeader } from '@/features/home/components/section-header'
import { ListError, NoLiveChannels, STREAM_GRID, StreamGrid } from '@/features/home/live-grid'
import { StreamCard } from '@/features/home/components/stream-card'
import { useCategories } from '@/features/categories/api'
import { useFollowedLive } from '@/features/channels/hooks/use-following'
import { CATEGORY_GRID, CategoryCard, CategoryCardSkeleton } from '@/features/discover/components/category-card'
import { InlineError } from '@/features/discover/components/list-states'
import { VOD_GRID, VodCard, VodCardSkeleton } from '@/features/discover/components/vod-card'
import { streamsApi } from '@/features/streams/api/streams-api'
import { useContinueWatching, useRecommendedStreams } from '@/features/streams/hooks/use-streams'
import { useNow } from '@/hooks/use-now'

/** Hero + 12 recommended cards (TSD §3.1: the hero is dropped from the row). */
const HOME_RECOMMENDED = 13

/** Horizontal row on phones/tablets (the last card peeks out), three across on desktop. */
const CONTINUE_ROW = 'flex snap-x gap-3 overflow-x-auto pb-1 md:gap-4 [&>*]:w-65 [&>*]:shrink-0 [&>*]:snap-start md:[&>*]:w-[calc((100%-1rem)/2)] xl:[&>*]:w-[calc((100%-2rem)/3)]'

/** "Chưa có ai đang phát": replaces the hero when nobody is live. */
function NobodyLive() {
  const { t } = useTranslation('home')
  const creator = useAuthStore((s) => isCreator(s.me))
  const gated = useGatedAction()

  return (
    <section
      className="flex min-h-90 flex-col items-center justify-center gap-4 rounded-panel border bg-surface bg-[radial-gradient(ellipse_60%_70%_at_50%_0%,color-mix(in_srgb,var(--primary)_12%,transparent),transparent)] p-8 text-center"
      aria-labelledby="nobody-live-title"
      data-testid="nobody-live"
    >
      <span className="grid size-16 place-items-center rounded-xl bg-primary/12 text-primary" aria-hidden>
        <RadioTowerIcon className="size-8" />
      </span>
      <h2 id="nobody-live-title" className="font-heading text-2xl leading-8 font-bold text-foreground md:text-[28px] md:leading-9">
        {t('nobodyLive.title')}
      </h2>
      <p className="text-body-lg text-muted-foreground">{t('nobodyLive.body')}</p>
      <div className="pt-2">
        {creator ? (
          <Button className="h-11 px-5.5" onClick={() => gated({ type: 'goLive' })}>
            <RadioTowerIcon />
            {t('nobodyLive.goLive')}
          </Button>
        ) : (
          <Button className="h-11 px-5.5" onClick={() => gated({ type: 'becomeCreator', tab: 'register' })}>
            <SparklesIcon />
            {t('nobodyLive.becomeCreator')}
          </Button>
        )}
      </div>
    </section>
  )
}

function ContinueWatching({ loadingLive }: { loadingLive: boolean }) {
  const { t } = useTranslation('home')
  const signedIn = useAuthStore((s) => s.status === 'authenticated')
  const { data: items, isPending } = useContinueWatching(signedIn)
  const now = useNow(60_000)

  // Guests (and accounts with nothing half-watched) do not get the row (01 · Trang chủ — Khách).
  if (!signedIn) return null
  const loading = isPending || (loadingLive && !items)
  if (!loading && (!items || items.length === 0)) return null

  return (
    <section aria-labelledby="continue-heading" className="flex flex-col gap-3 md:gap-4" data-testid="continue-watching">
      <SectionHeader
        id="continue-heading"
        icon={<HistoryIcon className="size-5 text-muted-foreground md:size-5.5" aria-hidden />}
        title={t('continue.heading')}
        count={items && items.length > 0 ? t('continue.count', { count: items.length }) : undefined}
      />
      <div className={CONTINUE_ROW}>
        {loading
          ? Array.from({ length: 3 }, (_, i) => <SkeletonContinueCard key={i} />)
          : items?.map((item) => <ContinueCard key={item.vod.id} item={item} now={now} />)}
      </div>
    </section>
  )
}

/** "Kênh theo dõi đang live": ≤ 4 by viewers; hidden for guests and when nobody followed is live (K7). */
function FollowedLive() {
  const { t } = useTranslation('home')
  const signedIn = useAuthStore((s) => s.status === 'authenticated')
  const live = useFollowedLive(12)
  const now = useNow(30_000)

  if (!signedIn) return null
  if (live.isError && !live.data) {
    return (
      <section aria-labelledby="followed-live-heading" className="flex flex-col gap-4">
        <SectionHeader id="followed-live-heading" title={t('followedLive.heading')} />
        <InlineError label={t('section.failed')} onRetry={() => void live.refetch()} />
      </section>
    )
  }
  if (!live.isPending && live.streams.length === 0) return null

  return (
    <section aria-labelledby="followed-live-heading" className="flex flex-col gap-4" data-testid="home-followed-live">
      <SectionHeader
        id="followed-live-heading"
        icon={<span className="size-2.5 rounded-full bg-live" aria-hidden />}
        title={t('followedLive.heading')}
        more={{ to: '/following', label: t('followedLive.seeAll') }}
      />
      {live.isPending ? (
        <StreamGrid items={undefined} loading />
      ) : (
        <div className={STREAM_GRID}>
          {live.streams.slice(0, 4).map((s) => (
            <StreamCard key={s.id} stream={s} now={now} />
          ))}
        </div>
      )}
    </section>
  )
}

/** "Danh mục phổ biến": six categories by live viewers → Khám phá in category mode. */
function PopularCategories() {
  const { t } = useTranslation('home')
  const categories = useCategories('viewers')

  if (categories.isSuccess && categories.data.length === 0) return null

  return (
    <section aria-labelledby="popular-categories-heading" className="flex flex-col gap-4" data-testid="home-categories">
      <SectionHeader id="popular-categories-heading" title={t('popularCategories.heading')} more={{ to: '/browse?view=categories', label: t('popularCategories.seeAll') }} />
      {categories.isError && !categories.data ? (
        <InlineError label={t('section.failed')} onRetry={() => void categories.refetch()} />
      ) : (
        <div className={CATEGORY_GRID}>
          {categories.isPending
            ? Array.from({ length: 6 }, (_, i) => <CategoryCardSkeleton key={i} />)
            : categories.data.slice(0, 6).map((c) => <CategoryCard key={c.id} category={c} />)}
        </div>
      )}
    </section>
  )
}

/** "Video đề xuất": four public replays, no view counts (K7). */
function RecommendedVideos() {
  const { t } = useTranslation('home')
  const now = useNow(60_000)
  const vods = useQuery({ queryKey: ['vods', 'recommended'], queryFn: () => streamsApi.recommendedVods(12), select: (d) => d?.items ?? [] })

  if (vods.isSuccess && vods.data.length === 0) return null

  return (
    <section aria-labelledby="recommended-videos-heading" className="flex flex-col gap-4" data-testid="home-videos">
      <SectionHeader id="recommended-videos-heading" title={t('recommendedVideos.heading')} />
      {vods.isError && !vods.data ? (
        <InlineError label={t('section.failed')} onRetry={() => void vods.refetch()} />
      ) : (
        <div className={VOD_GRID}>
          {vods.isPending ? Array.from({ length: 4 }, (_, i) => <VodCardSkeleton key={i} />) : vods.data.slice(0, 4).map((v) => <VodCard key={v.id} vod={v} now={now} />)}
        </div>
      )}
    </section>
  )
}

/**
 * 01 · Trang chủ (K7): Hero → Tiếp tục xem → Kênh theo dõi đang live → Kênh trực tiếp đề xuất → Danh mục phổ biến
 * → Video đề xuất → Creator CTA. Every block loads and fails on its own (G4-Q3); the hero and the recommended row
 * share one call (`/v1/streams/recommended`, the hero is its first item).
 */
export function HomePage() {
  const { t } = useTranslation('home')
  const live = useRecommendedStreams(HOME_RECOMMENDED)
  const now = useNow(60_000)
  const items = live.data
  const featured = items?.[0] ?? null
  const rest = items?.slice(1)
  const failed = live.isError && !live.data
  const nobodyLive = items !== undefined && items.length === 0

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-7 px-4 pt-4 pb-6 md:gap-9 md:p-4 xl:p-6">
      <h1 className="sr-only">{t('title')}</h1>
      {failed ? (
        <ListError onRetry={() => void live.refetch()} className="min-h-80 rounded-panel border bg-surface xl:min-h-120" />
      ) : live.isPending ? (
        <HomeHeroSkeleton />
      ) : featured ? (
        <HomeHero stream={featured} now={now} />
      ) : (
        <NobodyLive />
      )}
      <ContinueWatching loadingLive={live.isPending} />
      <FollowedLive />
      {!failed && (!nobodyLive || live.isPending) && (rest === undefined || rest.length > 0) && (
        <section aria-labelledby="live-heading" className="flex flex-col gap-4">
          <SectionHeader id="live-heading" icon={<span className="size-2.5 rounded-full bg-live" aria-hidden />} title={t('live.heading')} />
          <StreamGrid items={rest} loading={live.isPending} />
        </section>
      )}
      {nobodyLive && (
        <section aria-labelledby="live-heading" className="flex flex-col gap-4">
          <SectionHeader id="live-heading" title={t('live.heading')} />
          <NoLiveChannels />
        </section>
      )}
      <PopularCategories />
      <RecommendedVideos />
      {/* NXL-C BR02: the Creator CTA closes the page; hidden when the intro already offers it. */}
      {!nobodyLive && <CreatorCta />}
    </div>
  )
}

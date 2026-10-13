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
import { featuredStream } from '@/features/home/lib/featured'
import { ListError, NoLiveChannels, StreamGrid } from '@/features/home/live-grid'
import { useContinueWatching, useLiveStreams } from '@/features/streams/hooks/use-streams'
import { useNow } from '@/hooks/use-now'

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

/** 01 · Trang chủ (R2): hero, "Tiếp tục xem", recommended live channels, Creator CTA. */
export function HomePage() {
  const { t } = useTranslation('home')
  const live = useLiveStreams()
  const now = useNow(60_000)
  const items = live.data?.items
  const featured = featuredStream(items)
  const failed = live.isError && !live.data
  const nobodyLive = items !== undefined && items.length === 0

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-7 px-4 pt-4 pb-6 md:gap-9 md:p-4 xl:p-6">
      <h1 className="sr-only">{t('title')}</h1>
      {failed ? (
        <ListError onRetry={() => void live.refetch()} className="min-h-80 rounded-panel border bg-surface xl:min-h-120" />
      ) : (
        <>
          {live.isPending ? <HomeHeroSkeleton /> : featured ? <HomeHero stream={featured} now={now} /> : <NobodyLive />}
          <ContinueWatching loadingLive={live.isPending} />
          <section aria-labelledby="live-heading" className="flex flex-col gap-4">
            <SectionHeader
              id="live-heading"
              icon={nobodyLive ? undefined : <span className="size-2.5 rounded-full bg-live" aria-hidden />}
              title={t('live.heading')}
            />
            {nobodyLive ? <NoLiveChannels /> : <StreamGrid items={items} loading={live.isPending} />}
          </section>
        </>
      )}
      {/* NXL-C BR02: the Creator CTA closes the page; hidden when the intro already offers it. */}
      {!nobodyLive && <CreatorCta />}
    </div>
  )
}

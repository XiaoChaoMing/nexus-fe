import { useTranslation } from 'react-i18next'
import { RadioTowerIcon, RotateCwIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { SkeletonStreamCard } from '@/components/ui/skeleton'
import { SectionHeader } from '@/features/home/components/section-header'
import { StreamCard } from '@/features/home/components/stream-card'
import { useLiveStreams } from '@/features/streams/hooks/use-streams'
import type { Stream } from '@/features/streams/types'
import { useNow } from '@/hooks/use-now'

export const STREAM_GRID = 'grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-x-4 md:gap-y-6 xl:grid-cols-4 2xl:grid-cols-5'

/** Empty State "Chưa có kênh nào đang trực tiếp" in a framed panel. */
export function NoLiveChannels() {
  const { t } = useTranslation('home')

  return (
    <Empty className="rounded-panel border bg-surface" data-testid="live-empty">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <RadioTowerIcon />
        </EmptyMedia>
        <EmptyTitle>{t('live.empty')}</EmptyTitle>
        <EmptyDescription>{t('live.emptyBody')}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

/** Error Panel: "Không tải được danh sách" + "Thử lại". */
export function ListError({ onRetry, className }: { onRetry: () => void; className?: string }) {
  const { t } = useTranslation(['home', 'common'])

  return (
    <Empty className={className ?? 'rounded-panel border bg-surface'} role="alert" data-testid="home-error">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <RadioTowerIcon />
        </EmptyMedia>
        <EmptyTitle>{t('home:live.loadFailed')}</EmptyTitle>
        <EmptyDescription>{t('home:live.loadFailedBody')}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="secondary" className="font-medium" onClick={onRetry}>
          <RotateCwIcon />
          {t('common:actions.retry')}
        </Button>
      </EmptyContent>
    </Empty>
  )
}

/** Card grid of live streams (or 4 skeleton cards while loading). */
export function StreamGrid({ items, loading }: { items: Stream[] | undefined; loading?: boolean }) {
  const now = useNow(30_000)

  if (loading) {
    return (
      <div className={STREAM_GRID} aria-hidden>
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonStreamCard key={i} />
        ))}
      </div>
    )
  }

  return (
    <div className={STREAM_GRID}>
      {(items ?? []).map((s) => (
        <StreamCard key={s.id} stream={s} now={now} />
      ))}
    </div>
  )
}

/** Live channels with their own loading/empty/error states (Browse page). */
export function LiveGrid({ heading }: { heading?: string } = {}) {
  const { t } = useTranslation('home')
  const { data, isPending, isError, refetch } = useLiveStreams()

  return (
    <section aria-labelledby="live-heading" className="flex flex-col gap-4">
      <SectionHeader id="live-heading" icon={<span className="size-2.5 rounded-full bg-live" aria-hidden />} title={heading ?? t('live.heading')} />
      {isError && !data ? (
        <ListError onRetry={() => void refetch()} />
      ) : data && data.items.length === 0 ? (
        <NoLiveChannels />
      ) : (
        <StreamGrid items={data?.items} loading={isPending} />
      )}
    </section>
  )
}

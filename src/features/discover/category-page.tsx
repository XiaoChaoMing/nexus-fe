import { useTranslation } from 'react-i18next'
import { Link, useParams, useSearchParams } from 'react-router'
import { ChevronRightIcon, CompassIcon, FilmIcon, LayoutGridIcon, RadioTowerIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton, SkeletonStreamCard } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCategories, useCategory } from '@/features/categories/api'
import type { Category } from '@/features/categories/types'
import { CATEGORY_GRID, CategoryCard } from '@/features/discover/components/category-card'
import { FilterSelect } from '@/features/discover/components/filter-select'
import { useGroupLabel } from '@/features/discover/hooks/use-group-label'
import { EmptyPanel, ErrorPanel, LoadMore } from '@/features/discover/components/list-states'
import { VOD_GRID, VodCard, VodCardSkeleton } from '@/features/discover/components/vod-card'
import { useLiveList, useVodList } from '@/features/discover/hooks/use-live-list'
import { StreamCard } from '@/features/home/components/stream-card'
import { Thumbnail } from '@/features/home/components/thumbnail'
import { STREAM_GRID } from '@/features/home/live-grid'
import { streamsApi } from '@/features/streams/api/streams-api'
import { TagChip } from '@/features/streams/components/stream-meta'
import { useNow } from '@/hooks/use-now'
import { isApiError } from '@/lib/api-error'
import { compactCount } from '@/lib/format'

function CategoryHeader({ category: c }: { category: Category }) {
  const { t } = useTranslation('discover')
  const groupLabel = useGroupLabel()

  return (
    <header className="flex items-end gap-4 md:gap-5">
      <Thumbnail src={c.posterUrl} eager className="aspect-[3/4] w-22 shrink-0 overflow-hidden rounded-lg border md:w-30" />
      <div className="flex min-w-0 flex-col gap-2">
        <TagChip className="w-fit">{groupLabel(c.group)}</TagChip>
        <h1 className="font-heading text-2xl leading-8 font-semibold text-foreground md:text-[28px]">{c.name}</h1>
        {c.viewerCount !== null && (
          <span className="flex items-center gap-1.5 text-body-md font-medium text-foreground">
            <span className="size-2 rounded-full bg-live" aria-hidden />
            {t('category.viewersNow', { value: compactCount(c.viewerCount) })}
          </span>
        )}
        {c.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {c.tags.slice(0, 3).map((tag) => (
              <TagChip key={tag}>{tag}</TagChip>
            ))}
          </div>
        )}
      </div>
    </header>
  )
}

function LiveTab({ category, onVideos }: { category: Category; onVideos: () => void }) {
  const { t } = useTranslation('discover')
  const [sp, setSp] = useSearchParams()
  const sort = sp.get('sort') === 'newest' ? 'newest' : 'viewers'
  const now = useNow(30_000)
  const list = useLiveList({ categories: [category.id], sort })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <FilterSelect
          label={t('browse.sortLabel')}
          value={sort}
          options={[
            { value: 'viewers', label: t('browse.sorts.viewers') },
            { value: 'newest', label: t('browse.sorts.newest') },
          ]}
          onChange={(v) => {
            const next = new URLSearchParams(sp)
            if (v === 'newest') next.set('sort', v)
            else next.delete('sort')
            setSp(next, { replace: true })
          }}
        />
        {list.isSuccess && list.items.length > 0 && !list.hasNextPage && (
          <span className="ml-auto text-[13px] text-muted-foreground">{t('browse.liveCount', { count: list.items.length })}</span>
        )}
      </div>
      {list.isError && !list.data ? (
        <ErrorPanel icon={RadioTowerIcon} title={t('browse.loadFailed')} body={t('browse.loadFailedBody')} onRetry={() => void list.refetch()} />
      ) : list.isPending ? (
        <div className={STREAM_GRID} aria-busy>
          {Array.from({ length: 4 }, (_, i) => (
            <SkeletonStreamCard key={i} />
          ))}
        </div>
      ) : list.items.length === 0 ? (
        <EmptyPanel icon={RadioTowerIcon} title={t('category.liveEmptyTitle', { name: category.name })} testId="category-live-empty">
          <Button variant="secondary" onClick={onVideos}>
            {t('category.seeVideos')}
          </Button>
        </EmptyPanel>
      ) : (
        <>
          <div className={STREAM_GRID} data-testid="category-live-grid">
            {list.items.map((s) => (
              <StreamCard key={s.id} stream={s} now={now} />
            ))}
          </div>
          <LoadMore hasMore={Boolean(list.hasNextPage)} loading={list.isFetchingNextPage} failed={list.isFetchNextPageError} onMore={() => void list.fetchNextPage()} />
        </>
      )}
    </div>
  )
}

function VideosTab({ category }: { category: Category }) {
  const { t } = useTranslation('discover')
  const now = useNow(60_000)
  const list = useVodList(['vods', 'category', category.id], (cursor) => streamsApi.vods({ category: category.id, limit: 24 }, cursor))

  if (list.isError && !list.data) return <ErrorPanel icon={FilmIcon} title={t('browse.loadFailed')} body={t('browse.loadFailedBody')} onRetry={() => void list.refetch()} />
  if (list.isPending) {
    return (
      <div className={VOD_GRID} aria-busy>
        {Array.from({ length: 4 }, (_, i) => (
          <VodCardSkeleton key={i} />
        ))}
      </div>
    )
  }
  if (list.items.length === 0) return <EmptyPanel icon={FilmIcon} title={t('category.videosEmptyTitle')} testId="category-videos-empty" />

  return (
    <>
      <div className={VOD_GRID}>
        {list.items.map((v) => (
          <VodCard key={v.id} vod={v} now={now} />
        ))}
      </div>
      <LoadMore hasMore={Boolean(list.hasNextPage)} loading={list.isFetchingNextPage} failed={list.isFetchNextPageError} onMore={() => void list.fetchNextPage()} />
    </>
  )
}

function CategoryNotFound() {
  const { t } = useTranslation('discover')
  const popular = useCategories('viewers')

  return (
    <div className="flex flex-col gap-8">
      <EmptyPanel icon={CompassIcon} title={t('category.notFoundTitle')} body={t('category.notFoundBody')} testId="category-not-found">
        <Button asChild>
          <Link to="/browse">{t('category.backToBrowse')}</Link>
        </Button>
      </EmptyPanel>
      {popular.data && popular.data.length > 0 && (
        <section aria-labelledby="popular-heading" className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 id="popular-heading" className="font-heading text-xl font-semibold">
              {t('category.popular')}
            </h2>
            <Link to="/browse?view=categories" className="text-label-md text-primary hover:underline">
              {t('category.seeAll')}
            </Link>
          </div>
          <div className={CATEGORY_GRID}>
            {popular.data.slice(0, 6).map((c) => (
              <CategoryCard key={c.id} category={c} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

/** /browse/:slug — 02b · Trang danh mục: header, tabs Live / Video (`?tab=`), no category follow (K2). */
export function CategoryPage() {
  const { t } = useTranslation('discover')
  const { slug = '' } = useParams()
  const [sp, setSp] = useSearchParams()
  const tab = sp.get('tab') === 'videos' ? 'videos' : 'live'
  const query = useCategory(slug)
  const setTab = (next: string) => {
    const p = new URLSearchParams()
    if (next === 'videos') p.set('tab', 'videos')
    setSp(p, { replace: true })
  }

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 px-4 py-5 md:gap-6 md:p-4 xl:p-6">
      {query.isError && isApiError(query.error) && query.error.status === 404 ? (
        <CategoryNotFound />
      ) : query.isError ? (
        <ErrorPanel icon={LayoutGridIcon} title={t('browse.loadFailed')} body={t('browse.loadFailedBody')} onRetry={() => void query.refetch()} />
      ) : !query.data ? (
        <div className="flex items-end gap-5" aria-busy>
          <Skeleton className="aspect-[3/4] w-30" />
          <div className="flex flex-col gap-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-60" />
          </div>
        </div>
      ) : (
        <>
          <nav aria-label={t('category.breadcrumb')} className="flex items-center gap-1.5 text-[13px]">
            <Link to="/browse" className="text-muted-foreground hover:text-foreground">
              {t('browse.title')}
            </Link>
            <ChevronRightIcon className="size-4 text-subtle-foreground" aria-hidden />
            <span className="font-medium text-foreground" aria-current="page">
              {query.data.name}
            </span>
          </nav>
          <CategoryHeader category={query.data} />
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="live">{t('category.tabs.live')}</TabsTrigger>
              <TabsTrigger value="videos">{t('category.tabs.videos')}</TabsTrigger>
            </TabsList>
          </Tabs>
          {tab === 'live' ? <LiveTab category={query.data} onVideos={() => setTab('videos')} /> : <VideosTab category={query.data} />}
        </>
      )}
    </div>
  )
}

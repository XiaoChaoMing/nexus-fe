import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { ArrowUpIcon, LayoutGridIcon, RadioTowerIcon, SearchXIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SkeletonStreamCard } from '@/components/ui/skeleton'
import { useCategories } from '@/features/categories/api'
import { CATEGORY_GROUPS, type CategoryGroup } from '@/features/categories/types'
import { CATEGORY_GRID, CategoryCard, CategoryCardSkeleton } from '@/features/discover/components/category-card'
import { FilterSelect, Pill, Segmented } from '@/features/discover/components/filter-select'
import { useGroupLabel } from '@/features/discover/hooks/use-group-label'
import { EmptyPanel, ErrorPanel, LoadMore } from '@/features/discover/components/list-states'
import { useLiveList } from '@/features/discover/hooks/use-live-list'
import { addTag, browseSearch, categoryIdsOf, hasFilters, parseBrowseParams, type BrowseParams } from '@/features/discover/lib/browse-params'
import { StreamCard } from '@/features/home/components/stream-card'
import { STREAM_GRID } from '@/features/home/live-grid'
import { useNow } from '@/hooks/use-now'

/** A loaded list older than this offers "Có cập nhật mới" (K1). */
const STALE_AFTER_MS = 60_000

function useBrowseParams(): [BrowseParams, (next: BrowseParams) => void] {
  const [sp, setSp] = useSearchParams()
  const params = parseBrowseParams(sp)

  return [params, (next) => setSp(new URLSearchParams(browseSearch(next).slice(1)), { replace: false })]
}

function LiveMode({ params, setParams }: { params: BrowseParams; setParams: (p: BrowseParams) => void }) {
  const { t } = useTranslation(['discover', 'common'])
  const now = useNow(15_000)
  const categories = useCategories()
  const ids = categoryIdsOf(categories.data, params.group)
  const waiting = params.group !== null && !categories.data
  const list = useLiveList({ categories: ids, language: params.language, tags: params.tags, sort: params.sort }, !waiting)
  const filtered = hasFilters(params) || params.group !== null
  const stale = list.isSuccess && now - list.dataUpdatedAt > STALE_AFTER_MS

  const refresh = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    void list.refetch()
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <FilterSelect
          label={t('discover:browse.sortLabel')}
          value={params.sort}
          options={[
            { value: 'viewers', label: t('discover:browse.sorts.viewers') },
            { value: 'newest', label: t('discover:browse.sorts.newest') },
          ]}
          onChange={(sort) => setParams({ ...params, sort })}
          testId="browse-sort"
        />
        <FilterSelect
          label={t('discover:browse.languageLabel')}
          value={params.language ?? 'all'}
          options={[
            { value: 'all', label: t('discover:browse.languages.all') },
            { value: 'vi', label: t('discover:browse.languages.vi') },
            { value: 'en', label: t('discover:browse.languages.en') },
          ]}
          onChange={(v) => setParams({ ...params, language: v === 'all' ? null : v })}
        />
        {params.tags.map((tag) => (
          <span key={tag} className="inline-flex h-8 items-center gap-0.5 rounded-control border border-primary bg-card pr-1 pl-3 text-[13px] font-semibold">
            {tag}
            <button
              type="button"
              className="grid size-6 place-items-center rounded-sm text-muted-foreground hover:text-foreground"
              aria-label={t('discover:browse.removeTag', { tag })}
              onClick={() => setParams({ ...params, tags: params.tags.filter((x) => x !== tag) })}
            >
              <XIcon className="size-4" />
            </button>
          </span>
        ))}
        {hasFilters(params) && (
          <Button variant="ghost" size="sm" onClick={() => setParams({ ...params, language: null, tags: [] })}>
            {t('discover:browse.clearFilters')}
          </Button>
        )}
        {list.isSuccess && list.items.length > 0 && !list.hasNextPage && (
          <span className="ml-auto text-[13px] text-muted-foreground">{t('discover:browse.liveCount', { count: list.items.length })}</span>
        )}
      </div>

      {stale && (
        <div className="sticky top-18 z-20 flex justify-center">
          <Button size="sm" onClick={refresh} data-testid="browse-updates">
            <ArrowUpIcon />
            {t('discover:browse.updates')}
          </Button>
        </div>
      )}

      {list.isError && !list.data ? (
        <ErrorPanel icon={RadioTowerIcon} title={t('discover:browse.loadFailed')} body={t('discover:browse.loadFailedBody')} onRetry={() => void list.refetch()} />
      ) : list.empty || (list.isSuccess && list.items.length === 0) ? (
        filtered ? (
          <EmptyPanel icon={SearchXIcon} title={t('discover:browse.noMatchTitle')} body={t('discover:browse.noMatchBody')} testId="browse-no-match">
            {hasFilters(params) && (
              <Button variant="secondary" onClick={() => setParams({ ...params, language: null, tags: [] })}>
                {t('discover:browse.clearFilters')}
              </Button>
            )}
          </EmptyPanel>
        ) : (
          <EmptyPanel icon={RadioTowerIcon} title={t('discover:browse.emptyTitle')} body={t('discover:browse.emptyBody')} testId="browse-empty">
            <Button onClick={() => setParams({ ...params, view: 'categories' })}>{t('discover:browse.seeCategories')}</Button>
          </EmptyPanel>
        )
      ) : list.isPending || waiting ? (
        <div className={STREAM_GRID} aria-busy>
          {Array.from({ length: 8 }, (_, i) => (
            <SkeletonStreamCard key={i} />
          ))}
        </div>
      ) : (
        <>
          <div className={STREAM_GRID} data-testid="browse-live-grid">
            {list.items.map((s) => (
              <StreamCard key={s.id} stream={s} now={now} onTag={(tag) => setParams(addTag(params, tag))} />
            ))}
          </div>
          <LoadMore hasMore={Boolean(list.hasNextPage)} loading={list.isFetchingNextPage} failed={list.isFetchNextPageError} onMore={() => void list.fetchNextPage()} />
        </>
      )}
    </>
  )
}

function CategoriesMode({ group }: { group: CategoryGroup | null }) {
  const { t } = useTranslation('discover')
  const categories = useCategories('viewers')
  const items = (categories.data ?? []).filter((c) => !group || c.group === group)

  if (categories.isError && !categories.data) {
    return <ErrorPanel icon={LayoutGridIcon} title={t('browse.loadFailed')} body={t('browse.loadFailedBody')} onRetry={() => void categories.refetch()} />
  }
  if (categories.isSuccess && items.length === 0) return <EmptyPanel icon={LayoutGridIcon} title={t('browse.categoriesEmpty')} />

  return (
    <div className={CATEGORY_GRID} data-testid="browse-category-grid">
      {categories.isPending ? Array.from({ length: 12 }, (_, i) => <CategoryCardSkeleton key={i} />) : items.map((c) => <CategoryCard key={c.id} category={c} />)}
    </div>
  )
}

/** /browse — 02 · Khám phá: group pills, Danh mục | Kênh live (default), sort / language / tag filters (K1). */
export function BrowsePage() {
  const { t } = useTranslation('discover')
  const groupLabel = useGroupLabel()
  const [params, setParams] = useBrowseParams()

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 px-4 py-5 md:gap-6 md:p-4 xl:p-6">
      <h1 className="font-heading text-headline-lg">{t('browse.title')}</h1>
      <div role="group" aria-label={t('browse.groupsLabel')} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
        <Pill selected={params.group === null} onClick={() => setParams({ ...params, group: null })}>
          {groupLabel('ALL')}
        </Pill>
        {CATEGORY_GROUPS.map((g) => (
          <Pill key={g} selected={params.group === g} onClick={() => setParams({ ...params, group: g })}>
            {groupLabel(g)}
          </Pill>
        ))}
      </div>
      <Segmented
        label={t('browse.viewLabel')}
        value={params.view}
        onChange={(view) => setParams({ ...params, view })}
        options={[
          { value: 'categories', label: t('browse.views.categories'), icon: LayoutGridIcon },
          { value: 'live', label: t('browse.views.live'), icon: RadioTowerIcon },
        ]}
        className="w-full md:w-fit"
      />
      {params.view === 'categories' ? <CategoriesMode group={params.group} /> : <LiveMode params={params} setParams={setParams} />}
    </div>
  )
}

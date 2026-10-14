import { useMemo, useState, type FormEvent } from 'react'
import { useInfiniteQuery, useQueries } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { SearchIcon, SearchXIcon } from 'lucide-react'
import { Skeleton, SkeletonStreamCard } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FollowButton } from '@/features/channels/components/follow-button'
import { ChannelRow, ChannelRowSkeleton } from '@/features/discover/components/channel-row'
import { EmptyPanel, InlineError, LoadMore } from '@/features/discover/components/list-states'
import { StreamCard } from '@/features/home/components/stream-card'
import { Thumbnail } from '@/features/home/components/thumbnail'
import { STREAM_GRID } from '@/features/home/live-grid'
import { searchApi } from '@/features/search/api'
import { SearchBox } from '@/features/search/components/search-box'
import { useSearchHistory } from '@/features/search/hooks/use-search-history'
import { highlight, searchQuery } from '@/features/search/lib/text'
import { SEARCH_TYPES, type SearchItem, type SearchType } from '@/features/search/types'
import { useRecommendedStreams } from '@/features/streams/hooks/use-streams'
import { useNow } from '@/hooks/use-now'
import { compactCount } from '@/lib/format'
import { cn } from '@/lib/utils'

const BLOCK = 4

function Title({ text, query }: { text: string; query: string }) {
  return (
    <>
      {highlight(text, query).map((s, i) => (s.match ? <strong key={i}>{s.text}</strong> : <span key={i}>{s.text}</span>))}
    </>
  )
}

/** `/{handle}` → handle (channel results carry the profile path as their target). */
function handleOf(target: string): string {
  return decodeURIComponent(target.replace(/^\/(c\/)?/, ''))
}

function ResultCard({ item, query }: { item: SearchItem; query: string }) {
  const { t } = useTranslation(['search', 'common'])

  switch (item.type) {
    case 'channel':
      return (
        <ChannelRow
          large
          channel={{ handle: handleOf(item.target), displayName: item.title, avatarUrl: item.imageUrl }}
          meta={item.subtitle}
          live={item.isLive}
          sub={item.isLive && item.viewerCount !== null ? t('search:results.viewers', { value: compactCount(item.viewerCount) }) : null}
          action={<FollowButton channel={{ id: item.id, handle: handleOf(item.target), displayName: item.title, avatarUrl: item.imageUrl }} size="sm" />}
        />
      )
    case 'category':
      return (
        <Link to={item.target} className="group flex flex-col overflow-hidden rounded-lg border bg-card hover:border-border-strong" data-testid="search-category">
          <Thumbnail src={item.imageUrl} className="aspect-[3/4] w-full" />
          <span className="flex flex-col gap-0.75 p-3">
            <span className="truncate text-[15px] font-semibold text-foreground group-hover:text-primary">
              <Title text={item.title} query={query} />
            </span>
            {item.viewerCount !== null && <span className="text-label-sm font-normal text-muted-foreground">{t('search:results.viewers', { value: compactCount(item.viewerCount) })}</span>}
          </span>
        </Link>
      )
    default:
      return (
        <Link to={item.target} className="group flex min-w-0 flex-col gap-2.5" data-testid={`search-${item.type}`}>
          <span className="relative block aspect-video overflow-hidden rounded-lg">
            <Thumbnail src={item.imageUrl} className={cn('size-full', item.isMature && 'blur-xl')} />
            {item.isLive && <span className="absolute top-2 left-2 rounded-control bg-live px-2 py-0.75 text-[11px] font-bold text-white uppercase">{t('common:status.onAir')}</span>}
            {item.isLive && item.viewerCount !== null && (
              <span className="absolute bottom-2 left-2 flex items-center gap-1.25 rounded-control bg-overlay px-2 py-0.75 text-label-sm font-semibold text-white">
                <span className="size-1.5 rounded-full bg-live" aria-hidden />
                {compactCount(item.viewerCount)}
              </span>
            )}
          </span>
          <span className="flex min-w-0 flex-col gap-1">
            <span className="line-clamp-2 text-[15px] leading-5 font-semibold text-foreground group-hover:text-primary">
              <Title text={item.title} query={query} />
            </span>
            {item.subtitle && <span className="truncate text-body-sm text-muted-foreground">{item.subtitle}</span>}
          </span>
        </Link>
      )
  }
}

const GRID: Record<SearchType, string> = {
  channel: 'flex flex-col gap-1',
  stream: STREAM_GRID,
  category: 'grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4 xl:grid-cols-6',
  vod: STREAM_GRID,
}

function ResultSkeletons({ type, count }: { type: SearchType; count: number }) {
  return (
    <div className={GRID[type]} aria-busy>
      {Array.from({ length: count }, (_, i) =>
        type === 'channel' ? <ChannelRowSkeleton key={i} /> : type === 'category' ? <Skeleton key={i} className="aspect-[3/4]" /> : <SkeletonStreamCard key={i} />,
      )}
    </div>
  )
}

function Trending() {
  const { t } = useTranslation('search')
  const now = useNow(60_000)
  const { data } = useRecommendedStreams(5)
  if (!data || data.length === 0) return null

  return (
    <section aria-labelledby="search-trending" className="flex flex-col gap-4">
      <h2 id="search-trending" className="font-heading text-lg font-semibold">
        {t('trending')}
      </h2>
      <div className={STREAM_GRID}>
        {data.map((s) => (
          <StreamCard key={s.id} stream={s} now={now} />
        ))}
      </div>
    </section>
  )
}

function NoResults() {
  const { t } = useTranslation('search')

  return (
    <div className="flex flex-col gap-8">
      <EmptyPanel icon={SearchXIcon} title={t('noResultsTitle')} body={t('noResultsBody')} testId="search-page-empty" />
      <Trending />
    </div>
  )
}

/** "Tất cả": one block per type (≤ 4 items), each loading and failing on its own, with "Xem thêm". */
function AllResults({ q, onType }: { q: string; onType: (t: SearchType) => void }) {
  const { t } = useTranslation('search')
  const results = useQueries({
    queries: SEARCH_TYPES.map((type) => ({ queryKey: ['search', 'all', q, type], queryFn: () => searchApi.search(q, type, null, BLOCK), staleTime: 30_000 })),
  })
  const settled = results.every((r) => !r.isPending)
  const nothing = settled && results.every((r) => r.isSuccess && r.data.items.length === 0)
  if (nothing) return <NoResults />

  return (
    <div className="flex flex-col gap-8">
      {SEARCH_TYPES.map((type, i) => {
        const r = results[i]
        if (!r || (r.isSuccess && r.data.items.length === 0)) return null

        return (
          <section key={type} aria-labelledby={`block-${type}`} className="flex flex-col gap-3" data-testid={`search-block-${type}`}>
            <div className="flex items-center justify-between">
              <h2 id={`block-${type}`} className="font-heading text-lg font-semibold">
                {t(`groups.${type}`)}
              </h2>
              {r.isSuccess && (
                <button type="button" onClick={() => onType(type)} className="text-label-md text-primary hover:underline">
                  {t('results.seeMore')}
                </button>
              )}
            </div>
            {r.isError ? (
              <InlineError label={t('results.blockFailed')} onRetry={() => void r.refetch()} />
            ) : r.isPending ? (
              <ResultSkeletons type={type} count={type === 'channel' ? 3 : BLOCK} />
            ) : (
              <div className={GRID[type]}>
                {r.data.items.map((item) => (
                  <ResultCard key={`${item.type}-${item.id}`} item={item} query={q} />
                ))}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}

function TypeResults({ q, type }: { q: string; type: SearchType }) {
  const { t } = useTranslation('search')
  const list = useInfiniteQuery({
    queryKey: ['search', 'type', q, type],
    queryFn: ({ pageParam }) => searchApi.search(q, type, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last?.nextCursor ?? null,
    staleTime: 30_000,
  })
  const items = useMemo(() => (list.data?.pages ?? []).flatMap((p) => p.items), [list.data])

  if (list.isError && !list.data) return <InlineError label={t('results.blockFailed')} onRetry={() => void list.refetch()} />
  if (list.isPending) return <ResultSkeletons type={type} count={8} />
  if (items.length === 0) return <NoResults />

  return (
    <>
      <div className={GRID[type]}>
        {items.map((item) => (
          <ResultCard key={`${item.type}-${item.id}`} item={item} query={q} />
        ))}
      </div>
      <LoadMore hasMore={Boolean(list.hasNextPage)} loading={list.isFetchingNextPage} failed={list.isFetchNextPageError} onMore={() => void list.fetchNextPage()} />
    </>
  )
}

/** Search field above the results (mobile has no top-bar search box). */
function SearchAgain({ q }: { q: string }) {
  const { t } = useTranslation('search')
  const navigate = useNavigate()
  const history = useSearchHistory()
  const [value, setValue] = useState(q)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const next = searchQuery(value)
    if (!next) return
    history.add(next)
    navigate(`/search?q=${encodeURIComponent(next)}`)
  }

  return (
    <form role="search" onSubmit={submit} className="flex h-11 items-center gap-2.5 rounded-lg border bg-surface px-3 md:hidden">
      <SearchIcon className="size-5 text-muted-foreground" aria-hidden />
      <input value={value} onChange={(e) => setValue(e.target.value)} type="search" enterKeyHint="search" aria-label={t('label')} placeholder={t('placeholder')} className="min-w-0 flex-1 bg-transparent text-base outline-none" />
    </form>
  )
}

/**
 * /search — without `q`: the full-screen search (15c, the mobile tab); with `?q=`: 15b · Kết quả tìm kiếm, tabs
 * Tất cả · Kênh · Live · Danh mục · Video (`?type=`).
 */
export function SearchPage() {
  const { t } = useTranslation('search')
  const navigate = useNavigate()
  const [sp, setSp] = useSearchParams()
  const q = searchQuery(sp.get('q') ?? '')
  const rawType = sp.get('type')
  const type = (SEARCH_TYPES as readonly string[]).includes(rawType ?? '') ? (rawType as SearchType) : 'all'

  if (!q) {
    return (
      <div className="mx-auto flex h-[calc(100dvh-7.5rem)] w-full max-w-3xl flex-col md:h-auto md:p-6">
        <h1 className="sr-only">{t('results.pageTitle')}</h1>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-surface md:rounded-panel md:border">
          <SearchBox variant="screen" onClose={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))} initialQuery={sp.get('q') ?? ''} />
        </div>
      </div>
    )
  }

  const setType = (next: string) => {
    const p = new URLSearchParams({ q })
    if (next !== 'all') p.set('type', next)
    setSp(p, { replace: true })
  }

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 px-4 py-5 md:gap-6 md:p-4 xl:p-6">
      <SearchAgain key={q} q={q} />
      <h1 className="font-heading text-headline-lg break-words" data-testid="search-title">
        {t('results.title', { query: q })}
      </h1>
      <Tabs value={type} onValueChange={setType}>
        <TabsList aria-label={t('results.tabsLabel')} className="overflow-x-auto">
          <TabsTrigger value="all">{t('results.tabs.all')}</TabsTrigger>
          {SEARCH_TYPES.map((ty) => (
            <TabsTrigger key={ty} value={ty}>
              {t(`results.tabs.${ty}`)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {type === 'all' ? <AllResults q={q} onType={setType} /> : <TypeResults key={`${q}-${type}`} q={q} type={type} />}
    </div>
  )
}

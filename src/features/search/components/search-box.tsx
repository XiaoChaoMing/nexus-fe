import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { ArrowLeftIcon, ClockIcon, CornerDownLeftIcon, RotateCwIcon, SearchIcon, SearchXIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { Skeleton } from '@/components/ui/skeleton'
import { channelName } from '@/features/channels/lib/channel-display'
import { searchApi } from '@/features/search/api'
import { useSearchHistory } from '@/features/search/hooks/use-search-history'
import { highlight, searchQuery } from '@/features/search/lib/text'
import { SEARCH_TYPES, type HistoryEntry, type SearchItem } from '@/features/search/types'
import { Thumbnail } from '@/features/home/components/thumbnail'
import { thumbSrc } from '@/features/home/lib/featured'
import { useRecommendedStreams } from '@/features/streams/hooks/use-streams'
import type { Stream } from '@/features/streams/types'
import { useNow } from '@/hooks/use-now'
import { compactCount } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Requests wait for typing to pause (TSD S5). */
const DEBOUNCE_MS = 200
const TRENDING = 5

type Option =
  | { kind: 'item'; key: string; item: SearchItem }
  | { kind: 'recent'; key: string; entry: HistoryEntry }
  | { kind: 'trending'; key: string; stream: Stream }
  | { kind: 'all'; key: string }

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const id = window.setTimeout(() => setV(value), ms)

    return () => window.clearTimeout(id)
  }, [value, ms])

  return v
}

/** Suggestions grouped Kênh → Live → Danh mục → Video; the previous answer stays while the next one loads. */
function useSuggest(raw: string) {
  const q = searchQuery(useDebounced(raw, DEBOUNCE_MS))

  return {
    q,
    query: useQuery({
      queryKey: ['search', 'suggest', q],
      queryFn: ({ signal }) => searchApi.suggest(q ?? '', signal),
      enabled: q !== null,
      placeholderData: keepPreviousData,
      staleTime: 30_000,
      retry: false,
    }),
  }
}

function Highlighted({ text, query }: { text: string; query: string }) {
  return (
    <>
      {highlight(text, query).map((s, i) =>
        s.match ? (
          <strong key={i} className="font-bold">
            {s.text}
          </strong>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  )
}

/** Search/Result Item: media by type, matched part in bold, subtitle, live dot + viewers. */
function ResultItem({ item, query }: { item: SearchItem; query: string }) {
  return (
    <>
      {item.type === 'channel' ? (
        <span className="size-9 shrink-0 overflow-hidden rounded-full bg-avatar">{item.imageUrl && <img src={item.imageUrl} alt="" className="size-full object-cover" />}</span>
      ) : item.type === 'category' ? (
        <Thumbnail src={item.imageUrl} className="h-9 w-6.75 shrink-0 overflow-hidden rounded-sm" />
      ) : (
        <Thumbnail src={item.imageUrl} className={cn('h-9 w-16 shrink-0 overflow-hidden rounded-sm', item.isMature && 'blur-sm')} />
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-body-md text-foreground">
          <Highlighted text={item.title} query={query} />
        </span>
        {item.subtitle && <span className="truncate text-label-sm font-normal text-muted-foreground">{item.subtitle}</span>}
      </span>
      {item.isLive && (
        <span className="flex shrink-0 items-center gap-1.25 text-label-sm font-semibold text-muted-foreground tabular-nums">
          <span className="size-1.75 rounded-full bg-live" aria-hidden />
          {item.viewerCount !== null && compactCount(item.viewerCount)}
        </span>
      )}
    </>
  )
}

function GroupTitle({ children, action }: { children: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5">
      <span className="text-[11px] font-semibold tracking-[0.8px] text-muted-foreground uppercase">{children}</span>
      {action}
    </div>
  )
}

type Props = {
  /** `palette`: the Ctrl+K dialog (footer hints, Esc closes); `screen`: the mobile / `/search` page. */
  variant: 'palette' | 'screen'
  onClose?: () => void
  initialQuery?: string
}

/**
 * The search field with its list (15a / 15c): recent searches and trending channels before typing, grouped
 * suggestions while typing, "Xem tất cả kết quả" last. ↑ ↓ move, Enter opens, Esc closes (combobox pattern).
 */
export function SearchBox({ variant, onClose, initialQuery = '' }: Props) {
  const { t } = useTranslation(['search', 'common'])
  const navigate = useNavigate()
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [raw, setRaw] = useState(initialQuery)
  const [active, setActive] = useState(0)
  const history = useSearchHistory()
  const trending = useRecommendedStreams(TRENDING)
  const now = useNow(60_000)
  const { q, query } = useSuggest(raw)
  const typed = searchQuery(raw)
  const showSuggest = typed !== null && q !== null
  const groups = useMemo(() => {
    const byType = new Map((query.data?.groups ?? []).map((g) => [g.type, g.items]))

    return SEARCH_TYPES.flatMap((type) => {
      const items = byType.get(type) ?? []

      return items.length > 0 ? [{ type, items }] : []
    })
  }, [query.data])
  const noResults = showSuggest && query.isSuccess && !query.isPlaceholderData && groups.length === 0
  const failed = showSuggest && query.isError

  const options: Option[] = useMemo(() => {
    if (showSuggest && !failed) {
      const out: Option[] = groups.flatMap((g) => g.items.map((item) => ({ kind: 'item' as const, key: `${item.type}-${item.id}`, item })))
      if (!noResults) out.push({ kind: 'all', key: 'all' })
      else out.push(...(trending.data ?? []).slice(0, TRENDING).map((s) => ({ kind: 'trending' as const, key: `t-${s.id}`, stream: s })))

      return out
    }

    return [
      ...history.items.map((entry) => ({ kind: 'recent' as const, key: `r-${entry.id}`, entry })),
      ...(failed ? [] : (trending.data ?? []).slice(0, TRENDING).map((s) => ({ kind: 'trending' as const, key: `t-${s.id}`, stream: s }))),
    ]
  }, [showSuggest, failed, groups, noResults, trending.data, history.items])

  // A new query starts at the top of the list.
  const [activeFor, setActiveFor] = useState(q)
  if (activeFor !== q) {
    setActiveFor(q)
    setActive(0)
  }
  const activeIndex = options.length === 0 ? -1 : Math.min(active, options.length - 1)

  const go = (to: string) => {
    onClose?.()
    navigate(to)
  }
  const openResults = (text: string) => {
    const valid = searchQuery(text)
    if (!valid) return
    history.add(valid)
    go(`/search?q=${encodeURIComponent(valid)}`)
  }
  const choose = (o: Option | undefined) => {
    if (!o) {
      openResults(raw)

      return
    }
    switch (o.kind) {
      case 'item':
        if (typed) history.add(typed)
        go(o.item.target)

        return
      case 'all':
        openResults(raw)

        return
      case 'recent':
        setRaw(o.entry.query)
        inputRef.current?.focus()

        return
      case 'trending':
        go(`/live/${o.stream.id}`)
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (options.length === 0) return
      const delta = e.key === 'ArrowDown' ? 1 : -1
      setActive((i) => (Math.min(i, options.length - 1) + delta + options.length) % options.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      choose(options[activeIndex])
    } else if (e.key === 'Escape' && variant === 'screen' && onClose) {
      onClose()
    }
  }

  useEffect(() => {
    if (activeIndex < 0) return
    document.getElementById(`${listId}-${activeIndex}`)?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, listId])

  const optionProps = (o: Option, i: number) => ({
    id: `${listId}-${i}`,
    role: 'option' as const,
    'aria-selected': i === activeIndex,
    onMouseMove: () => setActive(i),
    onMouseDown: (e: React.MouseEvent) => e.preventDefault(),
    onClick: () => choose(o),
    className: cn(
      'flex w-full cursor-pointer items-center gap-3 rounded-control px-3 py-2 text-left max-md:min-h-11',
      i === activeIndex && 'rounded-l-none border-l-2 border-primary bg-accent',
    ),
  })
  let index = -1
  const next = () => ++index

  const trendingList = (trending.data ?? []).slice(0, TRENDING)
  const trendingGroup = trendingList.length > 0 && (
    <div role="group" aria-label={t('search:trending')}>
      <GroupTitle>{t('search:trending')}</GroupTitle>
      {trendingList.map((s) => {
        const i = next()
        const name = channelName(s.channel) ?? s.title

        return (
          <div key={s.id} {...optionProps({ kind: 'trending', key: s.id, stream: s }, i)}>
            <Thumbnail src={thumbSrc(s.thumbnailUrl, now)} className="h-9 w-16 shrink-0 overflow-hidden rounded-sm" />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-body-md text-foreground">{name}</span>
              <span className="truncate text-label-sm font-normal text-muted-foreground">{s.title}</span>
            </span>
            {typeof s.viewerCount === 'number' && (
              <span className="flex shrink-0 items-center gap-1.25 text-label-sm font-semibold text-muted-foreground tabular-nums">
                <span className="size-1.75 rounded-full bg-live" aria-hidden />
                {compactCount(s.viewerCount)}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )

  const recentGroup = history.items.length > 0 && (
    <div role="group" aria-label={t('search:recent')}>
      <GroupTitle
        action={
          <button type="button" onClick={history.clearAll} className="rounded-sm text-label-sm text-muted-foreground hover:text-foreground">
            {t('search:clearAll')}
          </button>
        }
      >
        {t('search:recent')}
      </GroupTitle>
      {history.items.map((entry) => {
        const i = next()

        return (
          <div key={entry.id} {...optionProps({ kind: 'recent', key: entry.id, entry }, i)}>
            <ClockIcon className="size-4.5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="flex-1 truncate text-body-md text-foreground">{entry.query}</span>
            <button
              type="button"
              tabIndex={-1}
              aria-label={t('search:removeEntry', { query: entry.query })}
              onClick={(e) => {
                e.stopPropagation()
                history.remove(entry)
              }}
              className="grid size-7 place-items-center rounded-sm text-muted-foreground hover:text-foreground max-md:size-11"
            >
              <XIcon className="size-4" />
            </button>
          </div>
        )
      })}
    </div>
  )

  let body: React.ReactNode
  if (showSuggest && query.isPending) {
    body = (
      <div className="flex flex-col gap-2 p-3" aria-busy data-testid="search-loading">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-9 rounded-full" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-3 w-2/3 rounded-sm" />
              <Skeleton className="h-2.5 w-1/3 rounded-sm" />
            </div>
          </div>
        ))}
      </div>
    )
  } else if (failed) {
    body = (
      <>
        <div role="alert" className="flex flex-col items-center gap-3 px-4 py-6 text-center" data-testid="search-failed">
          <p className="text-body-md text-foreground">{t('search:failedTitle')}</p>
          <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>
            <RotateCwIcon />
            {t('common:actions.retry')}
          </Button>
        </div>
        {recentGroup}
      </>
    )
  } else if (noResults) {
    body = (
      <>
        <div className="flex flex-col items-center gap-1 px-4 py-6 text-center" data-testid="search-no-results">
          <SearchXIcon className="mb-1 size-6 text-muted-foreground" aria-hidden />
          <p className="text-body-md font-semibold text-foreground">{t('search:noResultsTitle')}</p>
          <p className="text-body-sm text-muted-foreground">{t('search:noResultsBody')}</p>
        </div>
        {trendingGroup}
      </>
    )
  } else if (showSuggest) {
    body = (
      <>
        {groups.map((g) => (
          <div key={g.type} role="group" aria-label={t(`search:groups.${g.type}`)} data-testid={`search-group-${g.type}`}>
            <GroupTitle>{t(`search:groups.${g.type}`)}</GroupTitle>
            {g.items.map((item) => {
              const i = next()

              return (
                <div key={`${item.type}-${item.id}`} {...optionProps({ kind: 'item', key: item.id, item }, i)} data-testid="search-result">
                  <ResultItem item={item} query={typed ?? ''} />
                </div>
              )
            })}
          </div>
        ))}
        {(() => {
          const i = next()

          return (
            <div {...optionProps({ kind: 'all', key: 'all' }, i)} data-testid="search-see-all">
              <SearchIcon className="size-4.5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="flex-1 truncate text-body-md text-foreground">{t('search:seeAllFor', { query: typed ?? '' })}</span>
              <Kbd className="h-5 border bg-background px-1.5 text-[11px]">
                <CornerDownLeftIcon />
              </Kbd>
            </div>
          )
        })()}
      </>
    )
  } else {
    body = (
      <>
        {recentGroup}
        {trendingGroup}
      </>
    )
  }

  return (
    <div className={cn('flex min-h-0 flex-col', variant === 'screen' && 'h-full')}>
      <div className={cn('flex shrink-0 items-center gap-3 border-b px-4', variant === 'palette' ? 'h-14' : 'h-14 bg-surface')}>
        {variant === 'screen' && onClose ? (
          <Button variant="ghost" size="icon" className="-ml-2 size-11" onClick={onClose} aria-label={t('search:back')}>
            <ArrowLeftIcon className="size-5" />
          </Button>
        ) : (
          <SearchIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        )}
        <input
          ref={inputRef}
          autoFocus
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          onKeyDown={onKeyDown}
          maxLength={100}
          type="search"
          enterKeyHint="search"
          placeholder={t('search:placeholder')}
          aria-label={t('search:label')}
          role="combobox"
          aria-expanded={options.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
          className="h-full min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-subtle-foreground [&::-webkit-search-cancel-button]:hidden"
          data-testid="search-input"
        />
        {raw && (
          <button type="button" onClick={() => setRaw('')} aria-label={t('search:clear')} className="grid size-8 place-items-center rounded-sm text-muted-foreground hover:text-foreground max-md:size-11">
            <XIcon className="size-4" />
          </button>
        )}
        {variant === 'palette' && (
          <button type="button" onClick={onClose} className="hidden md:block" aria-label={t('search:close')}>
            <Kbd className="h-5 border bg-background px-1.5 text-[11px] text-muted-foreground">Esc</Kbd>
          </button>
        )}
      </div>
      <div id={listId} role="listbox" aria-label={t('search:label')} className={cn('overflow-y-auto p-2', variant === 'palette' ? 'max-h-120' : 'flex-1')} data-testid="search-list">
        {body}
      </div>
      {variant === 'palette' && (
        <div className="hidden shrink-0 items-center gap-4 border-t px-4 py-2.5 text-label-sm font-normal text-muted-foreground md:flex" aria-hidden>
          <span className="flex items-center gap-1">
            <Kbd className="border bg-background">↑</Kbd>
            <Kbd className="border bg-background">↓</Kbd>
            {t('search:hints.move')}
          </span>
          <span className="flex items-center gap-1">
            <Kbd className="border bg-background">Enter</Kbd>
            {t('search:hints.open')}
          </span>
          <span className="flex items-center gap-1">
            <Kbd className="border bg-background">Esc</Kbd>
            {t('search:hints.close')}
          </span>
        </div>
      )}
    </div>
  )
}

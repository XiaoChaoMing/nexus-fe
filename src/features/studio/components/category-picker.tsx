import { useId, useMemo, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckIcon, ChevronDownIcon, SearchIcon, XIcon } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useCategories } from '@/features/categories/api'
import type { Category } from '@/features/categories/types'
import { useGroupLabel } from '@/features/discover/hooks/use-group-label'
import { Thumbnail } from '@/features/home/components/thumbnail'
import { matchesQuery } from '@/features/search/lib/text'
import { cn } from '@/lib/utils'

type Props = {
  value: string | null
  onChange: (id: string | null) => void
  /** Label element id (the caller renders the label). */
  labelId?: string
  invalid?: boolean
}

/**
 * Combobox for a category (S5): search with or without diacritics, each option with a small 3:4 poster, its name
 * and group; the choice shows as a chip with ×.
 */
export function CategoryPicker({ value, onChange, labelId, invalid }: Props) {
  const { t } = useTranslation('studio')
  const groupLabel = useGroupLabel()
  const listId = useId()
  const { data: categories = [] } = useCategories()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const selected = categories.find((c) => c.id === value) ?? null
  const options = useMemo(() => categories.filter((c) => !query.trim() || matchesQuery(`${c.name} ${c.slug} ${c.tags.join(' ')}`, query)), [categories, query])

  const pick = (c: Category | undefined) => {
    if (!c) return
    onChange(c.id)
    setOpen(false)
    setQuery('')
  }
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (options.length === 0) return
      setActive((i) => (Math.min(i, options.length - 1) + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      pick(options[Math.min(active, options.length - 1)])
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Popover
        open={open}
        onOpenChange={(o) => {
          setOpen(o)
          if (!o) setQuery('')
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-labelledby={labelId}
            aria-haspopup="listbox"
            aria-invalid={invalid || undefined}
            className={cn(
              'flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-transparent bg-background px-3 text-left text-[13px] outline-none focus-visible:border-primary max-md:h-11',
              invalid && 'border-destructive',
            )}
            data-testid="category-picker"
          >
            {selected ? (
              <span className="inline-flex min-w-0 items-center gap-2">
                <Thumbnail src={selected.posterUrl} className="h-6 w-4.5 shrink-0 overflow-hidden rounded-xs" />
                <span className="truncate font-medium text-foreground">{selected.name}</span>
              </span>
            ) : (
              <span className="flex-1 truncate text-subtle-foreground">{t('category.placeholder')}</span>
            )}
            <ChevronDownIcon className="ml-auto size-4 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-72 bg-surface p-0">
          <div className="flex h-10 items-center gap-2 border-b px-3">
            <SearchIcon className="size-4 text-muted-foreground" aria-hidden />
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setActive(0)
              }}
              onKeyDown={onKeyDown}
              placeholder={t('category.search')}
              aria-label={t('category.search')}
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-activedescendant={options.length > 0 ? `${listId}-${Math.min(active, options.length - 1)}` : undefined}
              className="h-full min-w-0 flex-1 bg-transparent text-[13px] outline-none"
            />
          </div>
          <div id={listId} role="listbox" aria-label={t('category.label')} className="max-h-72 overflow-y-auto p-1">
            {options.length === 0 ? (
              <p className="px-3 py-4 text-center text-body-sm text-muted-foreground">{t('category.none')}</p>
            ) : (
              options.map((c, i) => (
                <div
                  key={c.id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={c.id === value}
                  onMouseMove={() => setActive(i)}
                  onClick={() => pick(c)}
                  className={cn('flex cursor-pointer items-center gap-2.5 rounded-control px-2 py-1.5 max-md:min-h-11', i === Math.min(active, options.length - 1) && 'bg-accent')}
                >
                  <Thumbnail src={c.posterUrl} className="h-8 w-6 shrink-0 overflow-hidden rounded-xs" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[13px] font-medium text-foreground">{c.name}</span>
                    <span className="text-label-sm font-normal text-muted-foreground">{groupLabel(c.group)}</span>
                  </span>
                  {c.id === value && <CheckIcon className="size-4 text-primary" aria-hidden />}
                </div>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
      {selected && (
        <button type="button" onClick={() => onChange(null)} aria-label={t('category.clear')} className="grid size-10 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground max-md:size-11">
          <XIcon className="size-4" />
        </button>
      )}
    </div>
  )
}

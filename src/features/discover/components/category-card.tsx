import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Skeleton } from '@/components/ui/skeleton'
import type { Category } from '@/features/categories/types'
import { Thumbnail } from '@/features/home/components/thumbnail'
import { TagChip } from '@/features/streams/components/stream-meta'
import { compactCount } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Card/Category: 3:4 poster, name, "12,4K người xem", two tags. */
export function CategoryCard({ category: c, className }: { category: Category; className?: string }) {
  const { t } = useTranslation('discover')

  return (
    <Link
      to={`/browse/${c.slug}`}
      className={cn('group flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card outline-none hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring', className)}
      data-testid="category-card"
    >
      <Thumbnail src={c.posterUrl} className="aspect-[3/4] w-full" />
      <span className="flex min-w-0 flex-col gap-0.75 p-3">
        <span className="truncate text-[15px] leading-5 font-semibold text-foreground group-hover:text-primary" title={c.name}>
          {c.name}
        </span>
        {c.viewerCount !== null && <span className="text-label-sm font-normal text-muted-foreground">{t('category.viewers', { value: compactCount(c.viewerCount) })}</span>}
        {c.tags.length > 0 && (
          <span className="flex gap-1.5 overflow-hidden pt-1.5">
            {c.tags.slice(0, 2).map((tag) => (
              <TagChip key={tag}>{tag}</TagChip>
            ))}
          </span>
        )}
      </span>
    </Link>
  )
}

export function CategoryCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border bg-card" aria-hidden>
      <Skeleton className="aspect-[3/4] w-full rounded-none" />
      <div className="flex flex-col gap-2 p-3">
        <Skeleton className="h-3.5 w-3/4 rounded-sm" />
        <Skeleton className="h-3 w-1/2 rounded-sm" />
      </div>
    </div>
  )
}

export const CATEGORY_GRID = 'grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4 xl:grid-cols-6'

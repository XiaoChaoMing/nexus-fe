import { useEffect, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { RotateCwIcon, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

/** Framed Empty State used by every GĐ4 list (title, optional body and actions). */
export function EmptyPanel({ icon: Icon, title, body, children, testId, className }: { icon: LucideIcon; title: string; body?: string; children?: ReactNode; testId?: string; className?: string }) {
  return (
    <Empty className={cn('rounded-panel border bg-surface', className)} data-testid={testId}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        {body && <EmptyDescription>{body}</EmptyDescription>}
      </EmptyHeader>
      {children && <EmptyContent>{<div className="flex flex-wrap justify-center gap-2">{children}</div>}</EmptyContent>}
    </Empty>
  )
}

/** Error panel with "Thử lại". */
export function ErrorPanel({ icon, title, body, onRetry, className }: { icon: LucideIcon; title: string; body?: string; onRetry: () => void; className?: string }) {
  const { t } = useTranslation()

  return (
    <div role="alert">
      <EmptyPanel icon={icon} title={title} body={body} className={className}>
        <Button variant="secondary" onClick={onRetry}>
          <RotateCwIcon />
          {t('actions.retry')}
        </Button>
      </EmptyPanel>
    </div>
  )
}

/** Small inline error of one home block ("Không tải được" + "Thử lại"), the other blocks keep showing. */
export function InlineError({ label, onRetry, className }: { label: string; onRetry: () => void; className?: string }) {
  const { t } = useTranslation()

  return (
    <div role="alert" className={cn('flex items-center justify-center gap-3 rounded-panel border bg-surface p-5 text-body-md text-muted-foreground', className)} data-testid="section-error">
      {label}
      <Button variant="secondary" size="sm" onClick={onRetry}>
        <RotateCwIcon />
        {t('actions.retry')}
      </Button>
    </div>
  )
}

/**
 * Infinite scroll footer: loads the next page when it scrolls into view (24 at a time), with a button as the
 * keyboard / no-observer path and "Không tải thêm được" + "Thử lại" on failure.
 */
export function LoadMore({ hasMore, loading, failed, onMore }: { hasMore: boolean; loading: boolean; failed: boolean; onMore: () => void }) {
  const { t } = useTranslation(['discover', 'common'])
  const ref = useRef<HTMLDivElement>(null)
  const onMoreRef = useRef(onMore)
  useEffect(() => {
    onMoreRef.current = onMore
  })

  useEffect(() => {
    const el = ref.current
    if (!el || !hasMore || failed || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) onMoreRef.current()
    }, { rootMargin: '400px' })
    io.observe(el)

    return () => io.disconnect()
  }, [hasMore, failed])

  if (!hasMore) return null

  return (
    <div ref={ref} className="flex items-center justify-center gap-3 py-4 text-body-md text-muted-foreground">
      {failed ? (
        <>
          {t('discover:browse.loadMoreFailed')}
          <Button variant="secondary" size="sm" onClick={onMore}>
            <RotateCwIcon />
            {t('common:actions.retry')}
          </Button>
        </>
      ) : loading ? (
        <Spinner />
      ) : (
        <Button variant="ghost" size="sm" onClick={onMore}>
          {t('discover:loadMore')}
        </Button>
      )}
    </div>
  )
}
